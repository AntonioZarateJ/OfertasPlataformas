const calendarRoot = document.getElementById('newsCalendar');
const calendarData = document.getElementById('newsCalendarData');
const calendarGrid = document.getElementById('newsMonthGrid');
const calendarFilter = document.getElementById('newsCalendarPlatform');
const previousMonth = document.getElementById('newsPreviousMonth');
const nextMonth = document.getElementById('newsNextMonth');
const calendarMonthFormat = new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric',timeZone:'UTC'});
const calendarDayFormat = new Intl.DateTimeFormat('es-MX',{dateStyle:'full',timeZone:'UTC'});
const calendarToday = Date.parse(calendarRoot.dataset.today);
const calendarEntries = [...calendarData.querySelectorAll('.news-event')].map(node=>({
    node,start:Date.parse(node.dataset.start),end:Date.parse(node.dataset.end),
    platforms:node.dataset.platforms.split(' '),kind:node.dataset.kind,image:node.querySelector('img')?.src
}));
const calendarMonth = date => date.getUTCFullYear()*12+date.getUTCMonth();
const monthTime = (month,day = 1) => Date.UTC(Math.floor(month/12),month%12,day);
const firstCalendarMonth = calendarMonth(new Date(calendarToday));
const calendarLimit = Math.min(firstCalendarMonth+12, Math.max(firstCalendarMonth+3,
    ...calendarEntries.map(entry=>calendarMonth(new Date(entry.end)))));
let openCalendarMonth = firstCalendarMonth;
let openCalendarDay = calendarToday;

function calendarEventsFor(day) {
    return calendarEntries.filter(entry=>day>=entry.start && day<=entry.end &&
        (!calendarFilter.value || entry.platforms.includes(calendarFilter.value)));
}

function renderCalendarDay() {
    document.getElementById('newsDayTitle').textContent = calendarDayFormat.format(openCalendarDay);
    const agenda = document.getElementById('newsDayEvents');
    const events = calendarEventsFor(openCalendarDay);
    agenda.replaceChildren(...events.map(entry=>{
        const event = entry.node.cloneNode(true);
        const image = event.querySelector('img');
        if (image) {
            image.loading = 'eager';
            image.addEventListener('error',()=>image.remove(),{once:true});
        }
        return event;
    }));
    if (!events.length) {
        const empty = document.createElement('p');
        empty.className = 'news-day-empty';
        empty.textContent = 'Sin lanzamientos ni ventas confirmados para este día.';
        agenda.append(empty);
    }
    for (const button of calendarGrid.querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.day)===openCalendarDay));
}

function renderCalendarMonth() {
    const first = monthTime(openCalendarMonth);
    document.getElementById('newsMonthTitle').textContent = calendarMonthFormat.format(first);
    previousMonth.disabled = openCalendarMonth === firstCalendarMonth;
    nextMonth.disabled = openCalendarMonth === calendarLimit;
    const days = (monthTime(openCalendarMonth+1)-first)/radarDayMs;
    const leading = (new Date(first).getUTCDay()+6)%7;
    const cells = Array.from({length:leading},()=>document.createElement('span'));
    for (let date=1;date<=days;date++) {
        const day = first+(date-1)*radarDayMs;
        const events = day < calendarToday ? [] : calendarEventsFor(day);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'news-calendar-day';
        button.dataset.day = day;
        button.disabled = day < calendarToday;
        if (day === calendarToday) button.setAttribute('aria-current','date');
        const count = events.length === 1 ? '1 evento' : `${events.length} eventos`;
        button.setAttribute('aria-label', `${calendarDayFormat.format(day)} · ${count}`);
        const number = document.createElement('strong');
        number.textContent = date;
        button.append(number);
        if (events.length) {
            const preview = document.createElement('span');
            preview.className = 'news-calendar-preview';
            preview.setAttribute('aria-hidden','true');
            for (const entry of events.slice(0,2)) {
                const tile = document.createElement('span');
                tile.dataset.newsPlatform = calendarFilter.value || entry.platforms[0];
                if (entry.image) {
                    const img = document.createElement('img');
                    img.src = entry.image;
                    img.alt = '';
                    img.loading = 'lazy';
                    img.addEventListener('error',()=>{
                        const fallback = document.createElement('i');
                        fallback.className = 'fa-solid fa-gamepad';
                        img.replaceWith(fallback);
                    },{once:true});
                    tile.append(img);
                } else {
                    const icon = document.createElement('i');
                    icon.className = entry.kind === 'festival' ? 'fa-solid fa-star' : 'fa-solid fa-tag';
                    tile.append(icon);
                }
                preview.append(tile);
            }
            if (events.length > 2) {
                const extra = document.createElement('small');
                extra.textContent = `+${events.length-2}`;
                preview.append(extra);
            }
            button.append(preview);
        }
        button.addEventListener('click',()=>{
            openCalendarDay = day;
            renderCalendarDay();
        });
        cells.push(button);
    }
    calendarGrid.replaceChildren(...cells);
    renderCalendarDay();
}

function turnCalendarMonth(step) {
    openCalendarMonth = Math.max(firstCalendarMonth,Math.min(calendarLimit,openCalendarMonth+step));
    const start = Math.max(calendarToday,monthTime(openCalendarMonth));
    const end = monthTime(openCalendarMonth+1);
    openCalendarDay = start;
    for (let day=start;day<end;day+=radarDayMs) {
        if (calendarEventsFor(day).length) {
            openCalendarDay = day;
            break;
        }
    }
    renderCalendarMonth();
}

previousMonth.addEventListener('click',()=>turnCalendarMonth(-1));
nextMonth.addEventListener('click',()=>turnCalendarMonth(1));
calendarFilter.addEventListener('change',renderCalendarMonth);
document.getElementById('newsCalendarRange').textContent =
    `De ${calendarMonthFormat.format(monthTime(firstCalendarMonth))} a ${calendarMonthFormat.format(monthTime(calendarLimit))}.`;
calendarRoot.hidden = false;
calendarData.hidden = true;
turnCalendarMonth(0);
