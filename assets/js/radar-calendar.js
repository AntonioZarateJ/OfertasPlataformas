const radarDayMs = 86_400_000;
const radarMexicoDate = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Mexico_City', year:'numeric', month:'numeric', day:'numeric'});

function radarCalendarDay(now) {
    const fields = Object.fromEntries(radarMexicoDate.formatToParts(now).map(({type,value}) => [type,Number(value)]));
    return Date.UTC(fields.year, fields.month - 1, fields.day);
}

function radarWeekStart(day) {
    return day - (new Date(day).getUTCDay() + 6) % 7 * radarDayMs;
}

function radarPicksAt({startsOn, original, rotation, scheduled = {}}, day) {
    const start = Date.parse(startsOn);
    if (day < start) return null;
    const firstMonday = start + ((8 - new Date(start).getUTCDay()) % 7) * radarDayMs;
    const index = (day - start) / radarDayMs + Math.max(0, Math.floor((day - firstMonday) / (7 * radarDayMs)));
    const week = [original, ...rotation];
    const picks = week[index % week.length];
    const override = scheduled[new Date(day).toISOString().slice(0, 10)];
    return override ? {...picks, ...override} : picks;
}

if (typeof module !== 'undefined') module.exports = {radarDayMs, radarCalendarDay, radarWeekStart, radarPicksAt};
