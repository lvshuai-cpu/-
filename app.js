const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const START_HOURS = Array.from({ length: 12 }, (_, index) => index + 8);
const STORAGE_KEY = "tutor-scheduler-classes-v1";
const PLAN_END_KEY = "tutor-scheduler-plan-end-v1";
const DEFAULT_PLAN_END = "2026-08-01";

const elements = {
  form: document.querySelector("#classForm"),
  student: document.querySelector("#student"),
  subject: document.querySelector("#subject"),
  day: document.querySelector("#day"),
  startTime: document.querySelector("#startTime"),
  mode: document.querySelector("#mode"),
  note: document.querySelector("#note"),
  weekStart: document.querySelector("#weekStart"),
  todayButton: document.querySelector("#todayButton"),
  schedule: document.querySelector("#schedule"),
  classList: document.querySelector("#classList"),
  classCount: document.querySelector("#classCount"),
  hourCount: document.querySelector("#hourCount"),
  planEnd: document.querySelector("#planEnd"),
  message: document.querySelector("#formMessage"),
  clearWeekButton: document.querySelector("#clearWeekButton"),
  cardTemplate: document.querySelector("#classCardTemplate"),
};

let classes = loadClasses();

function localDateString(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function getMonday(date = new Date()) {
  const result = new Date(date);
  const weekday = result.getDay() || 7;
  result.setDate(result.getDate() - weekday + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatHour(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function classTime(classItem) {
  return `${formatHour(classItem.startHour)}–${formatHour(classItem.startHour + 2)}`;
}

function getWeekKey() {
  return elements.weekStart.value;
}

function getWeekClasses() {
  return classes
    .filter((item) => item.weekStart === getWeekKey())
    .sort((a, b) => a.day - b.day || a.startHour - b.startHour);
}

function getClassDate(classItem) {
  const date = parseLocalDate(classItem.weekStart);
  date.setDate(date.getDate() + classItem.day);
  return date;
}

function getStatusLabel(classItem) {
  if (classItem.status === "missed") return classItem.makeupId ? "缺课 · 已补" : "缺课 · 待补";
  if (classItem.status === "makeup") return "补课";
  return "正常";
}

function getStatusClass(classItem) {
  if (classItem.status === "missed") return "status-missed";
  if (classItem.status === "makeup") return "status-makeup";
  return "status-normal";
}

function loadClasses() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveClasses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
}

function loadPlanEnd() {
  return localStorage.getItem(PLAN_END_KEY) || DEFAULT_PLAN_END;
}

function showMessage(message = "", type = "error") {
  elements.message.textContent = message;
  elements.message.style.color = type === "success" ? "#059669" : "#dc2626";
}

function populateSelects() {
  elements.day.innerHTML = DAYS.map((day, index) => `<option value="${index}">${day}</option>`).join("");
  elements.startTime.innerHTML = START_HOURS
    .map((hour) => `<option value="${hour}">${formatHour(hour)} – ${formatHour(hour + 2)}</option>`)
    .join("");
}

function renderSchedule() {
  const schedule = elements.schedule;
  schedule.innerHTML = "";
  const monday = parseLocalDate(getWeekKey());
  const today = localDateString(new Date());

  const corner = document.createElement("div");
  corner.className = "corner";
  schedule.append(corner);

  DAYS.forEach((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const header = document.createElement("div");
    header.className = `day-head${localDateString(date) === today ? " today" : ""}`;
    header.style.gridColumn = index + 2;
    header.style.gridRow = 1;
    header.innerHTML = `<b>${day}</b><span>${formatDate(date)}</span>`;
    schedule.append(header);
  });

  for (let row = 0; row < 13; row += 1) {
    const hour = row + 8;
    const label = document.createElement("div");
    label.className = "time-label";
    label.style.gridRow = row + 2;
    label.textContent = formatHour(hour);
    schedule.append(label);

    DAYS.forEach((_, day) => {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.style.gridColumn = day + 2;
      slot.style.gridRow = row + 2;
      schedule.append(slot);
    });
  }

  getWeekClasses().forEach((classItem) => {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.id = classItem.id;
    card.classList.toggle("mode-online", classItem.mode === "线上");
    card.classList.add(getStatusClass(classItem));
    card.style.gridColumn = classItem.day + 2;
    card.style.gridRow = `${classItem.startHour - 6} / span 2`;
    card.querySelector(".card-time").textContent = classTime(classItem);
    card.querySelector(".card-student").textContent = classItem.student;
    card.querySelector(".card-subject").textContent = classItem.subject;
    card.querySelector(".card-status").textContent = getStatusLabel(classItem);
    card.querySelector(".card-mode").textContent = classItem.mode;
    card.addEventListener("click", () => deleteClass(classItem.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        deleteClass(classItem.id);
      }
    });
    schedule.append(card);
  });
}

function renderClassList() {
  const weekClasses = getWeekClasses();
  elements.classCount.textContent = weekClasses.length;
  elements.hourCount.textContent = weekClasses.length * 2;
  elements.classList.innerHTML = "";

  if (!weekClasses.length) {
    elements.classList.innerHTML = '<div class="empty-state">本周还没有课程，先从左侧安排第一节课吧。</div>';
    return;
  }

  weekClasses.forEach((classItem) => {
    const item = document.createElement("article");
    item.className = "list-item";
    const canMarkAbsent = !classItem.status;
    const canArrangeMakeup = classItem.status === "missed" && !classItem.makeupId;
    item.innerHTML = `
      <div class="list-date">${formatDate(getClassDate(classItem))}<br>${classTime(classItem)}</div>
      <div class="list-info">
        <strong>${escapeHtml(classItem.student)} · ${escapeHtml(classItem.subject)}</strong>
        <span class="status-pill ${getStatusClass(classItem)}">${getStatusLabel(classItem)}</span>
        <span>${escapeHtml(classItem.mode)}${classItem.note ? ` · ${escapeHtml(classItem.note)}` : ""}</span>
      </div>
      ${canMarkAbsent ? '<button class="absent-button" type="button">标注缺课</button>' : ""}
      ${canArrangeMakeup ? '<button class="makeup-button" type="button">安排补课</button>' : ""}
      <button class="delete-button" type="button" aria-label="删除 ${escapeHtml(classItem.student)} 的课程">删除</button>
    `;
    item.querySelector(".absent-button")?.addEventListener("click", () => markAbsent(classItem.id));
    item.querySelector(".makeup-button")?.addEventListener("click", () => arrangeMakeup(classItem.id));
    item.querySelector(".delete-button").addEventListener("click", () => deleteClass(classItem.id));
    elements.classList.append(item);
  });
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function render() {
  renderSchedule();
  renderClassList();
}

function hasConflict(candidate) {
  const candidateDate = localDateString(getClassDate(candidate));
  return classes.some((item) => {
    const sameDay = candidateDate === localDateString(getClassDate(item));
    const overlaps = candidate.startHour < item.startHour + 2 && candidate.startHour + 2 > item.startHour;
    return sameDay && overlaps;
  });
}

function findMakeupSlot(afterDate) {
  const date = new Date(afterDate);
  date.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 366; dayOffset += 1) {
    const candidateDate = new Date(date);
    candidateDate.setDate(date.getDate() + dayOffset);
    const monday = getMonday(candidateDate);
    const day = (candidateDate.getDay() + 6) % 7;

    for (const startHour of START_HOURS) {
      const candidate = {
        weekStart: localDateString(monday),
        day,
        startHour,
      };
      if (!hasConflict(candidate)) return candidate;
    }
  }
  return null;
}

function arrangeMakeup(id) {
  const missedClass = classes.find((item) => item.id === id);
  if (!missedClass || missedClass.status !== "missed" || missedClass.makeupId) return;

  const planEnd = parseLocalDate(elements.planEnd.value);
  const originalDate = getClassDate(missedClass);
  const startDate = new Date(planEnd > originalDate ? planEnd : originalDate);
  startDate.setDate(startDate.getDate() + 1);
  const slot = findMakeupSlot(startDate);

  if (!slot) {
    saveClasses();
    showMessage("未来一年内没有找到可安排的两小时补课时段。\n");
    render();
    return;
  }

  const makeupClass = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ...slot,
    student: missedClass.student,
    subject: missedClass.subject,
    mode: missedClass.mode,
    note: missedClass.note ? `补课：${missedClass.note}` : "补课",
    status: "makeup",
    makeupFor: missedClass.id,
  };
  missedClass.makeupId = makeupClass.id;
  classes.push(makeupClass);
  saveClasses();
  showMessage(`已安排补课：${formatFullDate(getClassDate(makeupClass))} ${classTime(makeupClass)}。`, "success");
  render();
}

function markAbsent(id) {
  const classItem = classes.find((item) => item.id === id);
  if (!classItem || classItem.status) return;
  const accepted = window.confirm(`标注 ${classItem.student} 在${formatFullDate(getClassDate(classItem))} ${classTime(classItem)} 的课程为缺课？\n\n系统会自动将补课安排在计划结束日之后。`);
  if (!accepted) return;

  classItem.status = "missed";
  arrangeMakeup(id);
}

function deleteClass(id) {
  const classItem = classes.find((item) => item.id === id);
  if (!classItem) return;
  const linkedMakeup = classItem.makeupId && classes.find((item) => item.id === classItem.makeupId);
  const isMakeup = classItem.status === "makeup";
  const prompt = linkedMakeup
    ? `删除 ${classItem.student} 在${formatFullDate(getClassDate(classItem))} ${classTime(classItem)} 的缺课记录吗？关联的补课也会删除。`
    : isMakeup
      ? `删除 ${classItem.student} 在${formatFullDate(getClassDate(classItem))} ${classTime(classItem)} 的补课吗？原课程会恢复为“缺课 · 待补”。`
      : `删除 ${classItem.student} 在${formatFullDate(getClassDate(classItem))} ${classTime(classItem)} 的课程吗？`;
  const accepted = window.confirm(prompt);
  if (!accepted) return;
  if (linkedMakeup) {
    classes = classes.filter((item) => item.id !== id && item.id !== linkedMakeup.id);
  } else if (isMakeup) {
    const originalClass = classes.find((item) => item.id === classItem.makeupFor);
    if (originalClass) originalClass.makeupId = null;
    classes = classes.filter((item) => item.id !== id);
  } else {
    classes = classes.filter((item) => item.id !== id);
  }
  saveClasses();
  showMessage("");
  render();
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const classItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    weekStart: getWeekKey(),
    student: elements.student.value.trim(),
    subject: elements.subject.value.trim(),
    day: Number(elements.day.value),
    startHour: Number(elements.startTime.value),
    mode: elements.mode.value,
    note: elements.note.value.trim(),
  };

  if (!classItem.student || !classItem.subject) {
    showMessage("请填写学生姓名和授课科目。");
    return;
  }
  if (hasConflict(classItem)) {
    showMessage(`时间冲突：${DAYS[classItem.day]} ${classTime(classItem)} 已有课程。`);
    return;
  }
  if (getClassDate(classItem) > parseLocalDate(elements.planEnd.value)) {
    showMessage(`正常课程的计划结束日为${formatFullDate(parseLocalDate(elements.planEnd.value))}；缺课补课会自动顺延到之后。`);
    return;
  }

  classes.push(classItem);
  saveClasses();
  elements.form.reset();
  showMessage("课程已加入课表。", "success");
  render();
});

elements.weekStart.addEventListener("change", () => {
  const selected = parseLocalDate(elements.weekStart.value);
  elements.weekStart.value = localDateString(getMonday(selected));
  showMessage("");
  render();
});

elements.todayButton.addEventListener("click", () => {
  elements.weekStart.value = localDateString(getMonday());
  showMessage("");
  render();
});

elements.planEnd.addEventListener("change", () => {
  if (!elements.planEnd.value) elements.planEnd.value = DEFAULT_PLAN_END;
  localStorage.setItem(PLAN_END_KEY, elements.planEnd.value);
  showMessage("");
});

elements.clearWeekButton.addEventListener("click", () => {
  const weekClasses = getWeekClasses();
  if (!weekClasses.length) return;
  if (!window.confirm(`确定清空本周的 ${weekClasses.length} 节课程吗？`)) return;
  const idsToRemove = new Set(weekClasses.map((item) => item.id));
  weekClasses.forEach((classItem) => {
    if (classItem.status === "makeup") {
      const originalClass = classes.find((item) => item.id === classItem.makeupFor);
      if (originalClass && !idsToRemove.has(originalClass.id)) originalClass.makeupId = null;
    }
    if (classItem.makeupId) idsToRemove.add(classItem.makeupId);
  });
  classes = classes.filter((item) => !idsToRemove.has(item.id));
  saveClasses();
  showMessage("");
  render();
});

populateSelects();
elements.planEnd.value = loadPlanEnd();
elements.weekStart.value = localDateString(getMonday());
render();
