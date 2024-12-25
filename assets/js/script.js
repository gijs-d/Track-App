const db = new DB(
    {
        track: 'id',
        goals: 'title',
    },
    'goalsDB'
);
let userThemeDark = true;
let trackInterval;
let today;

document.addEventListener('DOMContentLoaded', init);

async function init() {
    showItems();
    getTheme();
    document.querySelector('#menuBtn').addEventListener('click', () => setTheme(!userThemeDark));
    document.querySelector('#stop .add').addEventListener('click', () => showAddForm());
    document.querySelector('#stop form .cancel').addEventListener('click', () => showAddForm());
    document.querySelector('#stop form ').addEventListener('submit', e => addTrack(e));
    document.querySelector('#start .add').addEventListener('click', () => showAddForm(true));
    document
        .querySelector('#start form .cancel')
        .addEventListener('click', () => showAddForm(true));
    document.querySelector('#start form ').addEventListener('submit', e => addTrack(e, true));
    document.querySelector('#weekly').addEventListener('input', () => toggleFormDivs());
    document.querySelector('#weekly2').addEventListener('input', () => toggleFormDivs(true));
    document.querySelector('#changeLim').addEventListener('input', () => toggleFormDivs());
    document.querySelector('#changeLim2').addEventListener('input', () => toggleFormDivs(true));
}

function calcShrinkOverTime(shrink, oudObj) {
    const max = {};
    const days = Math.floor((oudObj.maxStop.time - oudObj.maxStart.time) / (24 * 60 * 60 * 1000));
    const shrinkPerDay = shrink / days;
    const pastDays = Math.floor((Date.now() - oudObj.maxStart.time) / (24 * 60 * 60 * 1000));
    max['day'] = [
        Math.max(oudObj.maxStart.day - Math.floor(pastDays * shrinkPerDay), 0),
        Math.max(oudObj.maxStart.day - Math.floor((pastDays - 1) * shrinkPerDay), 0),
    ];
    const weekday = (new Date().getDay() + 6) % 7;
    let startWeek = pastDays - weekday;
    let endWeek = startWeek + 7;
    if (startWeek < 0) {
        startWeek = 0;
        endWeek = startWeek + (7 - weekday);
    }
    const k = Math.floor(oudObj.maxStart.day / shrinkPerDay);
    endWeek = Math.min(k, endWeek - 1);
    const thisWeek = Math.floor(
        (oudObj.maxStart.day - ((startWeek + endWeek) / 2) * shrinkPerDay) *
            (endWeek - startWeek + 1)
    );
    let lastWeek;
    endWeek = startWeek;
    if (startWeek >= 7) {
        startWeek -= 7;
        lastWeek = Math.floor(
            (oudObj.maxStart.day - ((startWeek + endWeek) / 2) * shrinkPerDay) *
                (endWeek - startWeek + 1)
        );
    } else {
        lastWeek = 0;
    }
    max['week'] = [thisWeek, lastWeek];
    return max;
}

function showOldObj(oudObj) {
    const max = calcMax(oudObj);
    const count = calcCount(oudObj);
    return {
        id: oudObj.id,
        last: oudObj.history.at(-1),
        max,
        count,
        maxStart: oudObj.maxStart,
        maxStop: oudObj.maxStop,
    };
}

function calcMax(oudObj) {
    let max = {};
    if (oudObj.maxStart.day) {
        if (Date.now() > oudObj.maxStop.time) {
            max['day'] = [oudObj.maxStop.day, oudObj.maxStop.day];
            max['week'] = [oudObj.maxStop.day * 7, oudObj.maxStop.day * 7];
        } else {
            const shrink = oudObj.maxStart.day - oudObj.maxStop.day;
            max = calcShrinkOverTime(shrink, oudObj);
        }
    } else {
        if (Date.now() > oudObj.maxStop.time) {
            max['week'] = [oudObj.maxStop.week, oudObj.maxStop.week];
        } else {
            const shrink = oudObj.maxStart.week - oudObj.maxStop.week;
            const { week } = calcShrinkOverTime(shrink, oudObj);
            max = { week };
        }
    }
    return max;
}

function calcCount(oudObj) {
    let startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    let [yesterday, startWeek, lastWeek] = [
        new Date(startDay),
        new Date(startDay),
        new Date(startDay),
    ];
    yesterday.setDate(yesterday.getDate() - 1);
    startWeek.setDate(startWeek.getDate() - ((startWeek.getDay() + 6) % 7));
    lastWeek.setDate(lastWeek.getDate() - ((lastWeek.getDay() + 6) % 7) - 7);
    const lastWeeks = oudObj.history.filter(o => o.time >= lastWeek.getTime());
    lastWeek = lastWeeks
        .filter(o => o.time <= startWeek.getTime())
        .reduce((a, o) => a + o.count, 0);
    startWeek = lastWeeks
        .filter(o => o.time >= startWeek.getTime())
        .reduce((a, o) => a + o.count, 0);
    yesterday = lastWeeks
        .filter(o => o.time >= yesterday.getTime() && o.time <= startDay.getTime())
        .reduce((a, o) => a + o.count, 0);
    startDay = lastWeeks.filter(o => o.time >= startDay.getTime()).reduce((a, o) => a + o.count, 0);
    return {
        day: [startDay, yesterday],
        week: [startWeek, lastWeek],
    };
}

async function addTrack(e, start) {
    e.preventDefault();
    const data = Object.fromEntries([...new FormData(e.target)].filter(d => d[1]));
    const type = start ? 'start' : 'stop';
    const form = document.querySelector(`#${type} form`);
    form.classList.toggle('hidden');
    form.reset();
    const maxStart = { time: Date.now() };
    if (data.amountDaily) {
        maxStart['day'] = Number(data.amountDaily);
        maxStart['week'] = Number(data.amountDaily) * 7;
    }
    if (data.amountWeekly) {
        maxStart['week'] = Number(data.amountWeekly);
    }
    const maxStop = { ...maxStart };
    if (data.maxDayTarget) {
        maxStop['day'] = Number(data.maxDayTarget);
        maxStop['week'] = Number(data.maxDayTarget) * 7;
    }
    if (data.maxWeekTarget) {
        maxStop['week'] = Number(data.maxWeekTarget);
    }
    if (data.targetDay) {
        maxStop['time'] = new Date(data.targetDay).getTime();
    }
    await db.add(db.stores.track, {
        id: `${type}-${data.title.replaceAll(' ', '_').replaceAll('"', '').replaceAll("'", '')}`,
        history: [],
        maxStart,
        maxStop,
    });
    showItems();
}

function showAddForm(start) {
    const type = start ? 'start' : 'stop';
    document.querySelectorAll(`#${type} form div input`).forEach(d => (d.value = ''));
    document.querySelector(`#${type} form`).classList.toggle('hidden');
}

function toggleFormDivs(start) {
    const type = start ? 'start' : 'stop';
    const add = start ? '2' : '';
    document.querySelectorAll(`#${type} form div`).forEach(d => d.classList.add('hidden'));
    document.querySelectorAll(`#${type} form div input`).forEach(d => {
        d.required = false;
        d.value = '';
    });
    const weekly = document.querySelector('#weekly' + add).checked ? 'weekly' : 'daily';
    const change = document.querySelector('#changeLim' + add).checked ? 'changeLim' : 'nChangeLim';
    document.querySelector(`#${type} form div.${change}.${weekly}`).classList.remove('hidden');
    document
        .querySelectorAll(`#${type} form div.${change}.${weekly} input`)
        .forEach(d => (d.required = true));
}

function getTheme() {
    if (window.matchMedia) {
        setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
    } else {
        setTheme(false);
    }
}

function setTheme(dark) {
    userThemeDark = dark;
    ['background-color', 'text-color', 'invert', 'shadow', 'toggle-img'].forEach(v =>
        changeCssValue(v, dark ? 'dark' : 'light')
    );
}

function changeCssValue(name, theme) {
    const root = document.querySelector(':root');
    root.style.setProperty(
        `--${name}`,
        getComputedStyle(root).getPropertyValue(`--${name}-${theme}`)
    );
}

async function showItems() {
    let trackers = await db.getAll(db.stores.track);
    console.log(trackers);
    trackers = trackers.map(t => showOldObj(t));
    console.log(trackers);
    document.querySelector('#stop ul').innerHTML = trackers
        .filter(t => t.id.includes('stop-'))
        .map(q => makeListItem(q))
        .join('');
    document.querySelector('#start ul').innerHTML = trackers
        .filter(t => t.id.includes('start-'))
        .map(q => makeListItem(q))
        .join('');
    addItemsEventListeners();
    clearInterval(trackInterval);
    today = new Date().toDateString();
    updateTrackersTime(trackers);
    trackInterval = setInterval(() => updateTrackersTime(trackers), 1000);
}

function addItemsEventListeners() {
    document
        .querySelectorAll('ul li input.addCount')
        .forEach(d => d.addEventListener('click', showAddCountForm));
    document
        .querySelectorAll('ul li div.addCountBtn .cancel')
        .forEach(d => d.addEventListener('click', showAddCountForm));
    document
        .querySelectorAll('ul li div.addCountBtn form')
        .forEach(d => d.addEventListener('submit', AddCount));
    document
        .querySelectorAll('ul li div.addCountBtn .nn')
        .forEach(d => d.addEventListener('click', showNotNow));
    document
        .querySelectorAll('ul li input.edit')
        .forEach(d => d.addEventListener('click', showEditForm));
    document
        .querySelectorAll('ul li div.editBtn .cancel')
        .forEach(d => d.addEventListener('click', showEditForm));
    document
        .querySelectorAll('ul li div.editBtn form')
        .forEach(d => d.addEventListener('submit', changeTracker));
    document
        .querySelectorAll('ul li div.editBtn form .clear')
        .forEach(d => d.addEventListener('dblclick', clearHistory));

    document
        .querySelectorAll('ul li div.editBtn form .deleteLast')
        .forEach(d => d.addEventListener('dblclick', deleteLast));
    document
        .querySelectorAll('ul li div.editBtn .delete')
        .forEach(d => d.addEventListener('dblclick', deleteTracker));
}

function showNotNow(e) {
    e.target.closest('form').querySelector('.addTime').classList.toggle('show', e.target.checked);
}

async function deleteTracker(e) {
    const id = e.target.closest('li').id;
    console.log(id);
    await db.delete(db.stores.track, id);
    showItems();
}

async function deleteLast(e) {
    const id = e.target.closest('li').id;
    const obj = await db.get(db.stores.track, id);
    obj.history.pop();
    await db.put(db.stores.track, obj);
    showItems();
}

async function clearHistory(e) {
    const id = e.target.closest('li').id;
    e.target.closest('.editTracker').classList.remove('showCountForm');
    const obj = await db.get(db.stores.track, id);
    obj.history = [];
    await db.put(db.stores.track, obj);
    showItems();
}

async function changeTracker(e) {
    e.preventDefault();
    const id = e.target.closest('li').id;
    const data = Object.fromEntries(new FormData(e.target));
    const obj = await db.get(db.stores.track, id);
    data.title = data.title.replaceAll(' ', '_').replaceAll('"', '').replaceAll("'", '');
    const maxStart = { time: Date.now() };
    if (data.amountDaily) {
        maxStart['day'] = Number(data.amountDaily);
        maxStart['week'] = Number(data.amountDaily) * 7;
    }
    if (data.amountWeekly) {
        maxStart['week'] = Number(data.amountWeekly);
    }
    const maxStop = { ...maxStart };
    if (data.maxDayTarget) {
        maxStop['day'] = Number(data.maxDayTarget);
        maxStop['week'] = Number(data.maxDayTarget) * 7;
    }
    if (data.maxWeekTarget) {
        maxStop['week'] = Number(data.maxWeekTarget);
    }
    if (data.targetDay) {
        maxStop['time'] = new Date(data.targetDay).getTime();
    }
    obj.maxStop = maxStop;
    obj.maxStart = maxStart;
    if (data.title != id.split('-')[1]) {
        obj.id = `${id.split('-')[0]}-${data.title}`;
        const ok = await db.add(db.stores.track, obj);
        if (ok) {
            await db.delete(db.stores.track, id);
        }
        obj.id = 1;
    } else {
        await db.put(db.stores.track, obj);
    }
    showItems();
}

async function AddCount(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const notNow = !!data.time;
    data['time'] = data.time ? new Date(data.time).getTime() : Date.now();
    data.count = Number(data.count);
    const id = e.target.closest('li').id;
    const obj = await db.get(db.stores.track, id);
    obj.history.push(data);
    if (notNow) {
        obj.history.sort((a, b) => a.time - b.time);
    }
    await db.put(db.stores.track, obj);
    showItems();
}

function showEditForm(e) {
    const form = e.target.closest('.editBtn').querySelector('.editTracker');
    document.querySelectorAll('.showCountForm').forEach(d => {
        if (d != form) {
            d.classList.remove('showCountForm');
        }
    });
    form.classList.toggle('showCountForm');
}

function showAddCountForm(e) {
    const form = e.target.closest('.addCountBtn').querySelector('.addAmount');
    document.querySelectorAll('.showCountForm').forEach(d => {
        if (d != form) {
            d.classList.remove('showCountForm');
        }
    });
    form.classList.toggle('showCountForm');
}

function updateTrackersTime(trackers) {
    if (today != new Date().toDateString()) {
        showItems();
        return;
    }
    trackers.forEach(q => {
        const last = showTimeSince(q.last?.time);
        document.querySelector(`#${q.id} .lastTime`).innerText = last == 'NaNs' ? 'none' : last;
    });
}

function showTimeSince(time) {
    const past = Date.now() - time;
    let minTime = 1000;
    const s = Math.floor((past % (60 * minTime)) / minTime);
    minTime *= 60;
    const m = Math.floor((past % (60 * minTime)) / minTime);
    minTime *= 60;
    const h = Math.floor((past % (24 * minTime)) / minTime);
    minTime *= 24;
    const d = Math.floor(past / minTime);
    if (d > 0) {
        return `${d}d ${h}h ${m}m ${s}s`;
    }
    if (h > 0) {
        return `${h}h ${m}m ${s}s`;
    }
    if (m > 0) {
        return `${m}m ${s}s`;
    }
    return `${s}s`;
}

function makeItemGoalsSettings(item) {
    if (item.maxStart.day) {
        return `
            <label for="amountDaily">Amount / Day</label>
            <input type="number" name="amountDaily" id="amountDaily" value="${
                item.maxStart.day
            }" required>
            ${makeGoalSettings('day', item)}`;
    }
    return `
        <label for="amountWeekly">Amount / Week</label>
                <input type="number" name="amountWeekly" id="amountWeekly" value="${
                    item.maxStart.week
                }"  required>
                ${makeGoalSettings('week', item)}`;
}

function makeGoalSettings(period, item) {
    if (item.maxStart[period] == item.maxStop[period]) {
        return '';
    }
    return `
        <label for="maxDayTarget">Goal / Day</label>
        <input type="number" name="maxDayTarget" id="maxDayTarget" value="${
            item.maxStop[period]
        }" required>
        <label for="targetDay">Goal on</label>
        <input type="date" name="targetDay" id="targetDay" value="${formatDate(
            item.maxStop.time
        )}" required >
    `;
}

function formatDate(date) {
    date = new Date(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function makeListItem(item) {
    return `
      <li id="${item.id}">
        <div class="title">
          <h3>${item.id.split('-')[1].replaceAll('_', ' ')}</h3>
         <div class="editBtn">
          <input type="button" class="edit">
                <input type="button" value=" " class="delete">
            <form class="editTracker" >
                <label for="title">Title</label>
                <input type="text" name="title" id="title" value="${item.id
                    .split('-')[1]
                    .replaceAll('_', ' ')}" required>
        ${makeItemGoalsSettings(item)} <input type="button" value="Cancel" class="cancel">
                <input type="submit" value="Update" class="update">
                <input type="button" value="Clear History" class="clear">
                <input type="button" value="Delete Last" class="deleteLast">
            </form>
         </div>
          <div class="addCountBtn">
            <input type="button" class="addCount" value="+">
                <form class="addAmount">
                    <label for="amount">Amount</label>
                    <input type="number" name="count" id="count" value="1" min="0" step="0.01" required>
                      <label for="nn" class="checkbox">Not now</label>
                        <input type="checkbox" id="nn" class="nn">
                        <div class="addTime">
                                <label for="time">On</label>
                                <input type="datetime-local" id="time" name="time">
                        </div>
                    <input type="button" value="Cancel" class="cancel">
                    <input type="submit" value="Add">
                </form>
          </div>
        </div>
        <div class="stats">
          <p>last: <span class="lastTime">${showTimeSince(item.last)}</span></p>
          <div class="last">
            <div class="day">
              <p>today: <span class="wrap">${item.count.day[0]} ${
        item.max.day ? `/ ${item.max.day[0]}` : ''
    }</span></p>
              <p>yesterday: <span class="wrap">${item.count.day[1]} ${
        item.max.day ? `/ ${item.max.day[1]}` : ''
    }</span></p>
            </div>
            <div class="week">
              <p>this week: <span class="wrap">${item.count.week[0]} / ${
        item.max.week[0] || 0
    }</span></p>
              <p>last week: <span class="wrap">${item.count.week[1]} / ${
        item.max.week[1] || 0
    }</span></p>
            </div>
          </div>
        </div>
      </li>`;
}
