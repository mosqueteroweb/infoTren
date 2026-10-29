"""
Genera data/programados.json con los trenes programados de Renfe (AV, LD y MD) de las próximas horas.

Los horarios salen del GTFS abierto de Renfe (data.renfe.com, licencia CC BY 4.0). El ZIP pesa unos 40 MB
descomprimido, demasiado para el móvil, así que aquí se reduce a los trenes que salen en una ventana
alrededor de ahora. Lo ejecuta el flujo update-trains.yml cada 2 horas.

Uso: python scripts/build_programados.py [destino.json] [google_transit.zip local, opcional]
"""

import csv
import io
import json
import os
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

GTFS_URL = "https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip"
MADRID = ZoneInfo("Europe/Madrid")
# The app shows the next 24 h and the file is rebuilt every 2 h (GitHub may run it late): 28 h ahead covers that.
# A few hours back keeps late trains that have not started yet.
WINDOW_BACK = timedelta(hours=3)
WINDOW_AHEAD = timedelta(hours=28)
MIN_TRAINS = 100
# Today the ZIP is about 1 MB and 40 MB unpacked; the caps only stop a broken or hostile download from filling the runner.
MAX_ZIP_BYTES = 30 * 1024 * 1024
MAX_UNPACKED_BYTES = 400 * 1024 * 1024

# Same codes as PRODUCTS in app.js, so the app shows the usual name and colour.
PRODUCT_CODES = {
    "AVE": 2,
    "AVE INT": 25,
    "AVLO": 28,
    "ALVIA": 11,
    "AVANT": 3,
    "AVANT EXP": 32,
    "EUROMED": 6,
    "Intercity": 13,
    "MD": 15,
    "REGIONAL": 18,
    "REG.EXP.": 19,
    "PROXIMDAD": 30,
    "TRENCELTA": 31,
}
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def read_table(archive, name):
    # Renfe pads every field with trailing spaces.
    with archive.open(f"{name}.txt") as raw:
        reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))
        for row in reader:
            yield {key.strip(): (value or "").strip() for key, value in row.items() if key}


def load_archive(local_zip):
    if local_zip:
        with open(local_zip, "rb") as f:
            content = f.read(MAX_ZIP_BYTES + 1)
    else:
        request = urllib.request.Request(GTFS_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            content = response.read(MAX_ZIP_BYTES + 1)
    if len(content) > MAX_ZIP_BYTES:
        raise ValueError("ZIP de horarios demasiado grande")
    archive = zipfile.ZipFile(io.BytesIO(content))
    if sum(info.file_size for info in archive.infolist()) > MAX_UNPACKED_BYTES:
        raise ValueError("ZIP de horarios demasiado grande al descomprimir")
    return archive


def service_runs_on(service_id, day, calendar, exceptions):
    stamp = day.strftime("%Y%m%d")
    exception = exceptions[service_id].get(stamp)
    if exception == "1":
        return True
    if exception == "2":
        return False
    entry = calendar.get(service_id)
    return bool(entry) and entry["start_date"] <= stamp <= entry["end_date"] and entry[WEEKDAYS[day.weekday()]] == "1"


def gtfs_time(day, text):
    # GTFS times count from the service day's midnight and can pass 24:00.
    hours, minutes, _ = (int(part) for part in text.split(":"))
    return datetime(day.year, day.month, day.day, tzinfo=MADRID) + timedelta(hours=hours, minutes=minutes)


def build(archive, now):
    calendar = {row["service_id"]: row for row in read_table(archive, "calendar")}
    exceptions = defaultdict(dict)
    for row in read_table(archive, "calendar_dates"):
        exceptions[row["service_id"]][row["date"]] = row["exception_type"]
    products = {row["route_id"]: PRODUCT_CODES.get(row["route_short_name"], 1) for row in read_table(archive, "routes")}
    trips = {row["trip_id"]: row for row in read_table(archive, "trips")}

    stops = defaultdict(list)
    for row in read_table(archive, "stop_times"):
        stops[row["trip_id"]].append((int(row["stop_sequence"]), row["stop_id"], row["arrival_time"], row["departure_time"]))

    start, end = now - WINDOW_BACK, now + WINDOW_AHEAD
    days = [(now - timedelta(days=1)).date() + timedelta(days=offset) for offset in range(4)]
    trains = []
    for trip_id, trip in trips.items():
        trip_stops = sorted(stops.get(trip_id, []))
        if len(trip_stops) < 2:
            continue
        for day in days:
            if not service_runs_on(trip["service_id"], day, calendar, exceptions):
                continue
            departure = gtfs_time(day, trip_stops[0][3] or trip_stops[0][2])
            if not start <= departure <= end:
                continue
            arrival = gtfs_time(day, trip_stops[-1][2] or trip_stops[-1][3])
            trains.append({
                "n": trip["trip_short_name"],
                "id": trip_id,
                "p": products.get(trip["route_id"], 1),
                "s": departure.isoformat(timespec="minutes"),
                "l": arrival.isoformat(timespec="minutes"),
                # Same shape as trenesConEstacionesLD.json: station, arrival, departure.
                "e": [[stop_id, hhmm(arr), hhmm(dep)] for _, stop_id, arr, dep in trip_stops],
            })
    return merge_variants(trains)


def merge_variants(trains):
    # Renfe often publishes two trips for the same train and departure (ids ending ...1 and ...2 before the date),
    # usually with different stop lists. Keep the one with most stops and remember every id for the cancellations.
    groups = defaultdict(list)
    for train in trains:
        groups[(train["n"].lstrip("0"), train["s"])].append(train)
    merged = []
    for variants in groups.values():
        best = max(variants, key=lambda t: len(t["e"]))
        others = [t["id"] for t in variants if t is not best]
        if others:
            best["ids"] = others
        merged.append(best)
    merged.sort(key=lambda t: (t["s"], t["n"]))
    return merged


def hhmm(text):
    if not text:
        return ""
    hours, minutes, _ = text.split(":")
    return f"{int(hours) % 24:02d}:{minutes}"


def main():
    destination = sys.argv[1] if len(sys.argv) > 1 else "data/programados.json"
    local_zip = sys.argv[2] if len(sys.argv) > 2 else None
    now = datetime.now(MADRID)
    try:
        trains = build(load_archive(local_zip), now)
        if len(trains) < MIN_TRAINS:
            raise ValueError(f"solo {len(trains)} trenes programados")
    except Exception as error:
        # Keep yesterday's file rather than publish an empty schedule.
        print(f"Se conserva la copia anterior de {destination}: {error}")
        return
    payload = {
        "generado": now.isoformat(timespec="minutes"),
        "fuente": "Renfe, data.renfe.com, CC BY 4.0",
        "trenes": trains,
    }
    os.makedirs(os.path.dirname(destination) or ".", exist_ok=True)
    with open(destination, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Generado {destination}: {len(trains)} trenes, {os.path.getsize(destination)} bytes")


if __name__ == "__main__":
    main()
