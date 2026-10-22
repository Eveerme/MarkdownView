const minute = 60_000;
const hour = 60 * minute;

const pad = (value: number) => String(value).padStart(2, "0");

const clock = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const yesterdayOf = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1);

export const formatRecentTime = (
  openedAt: number,
  now: number = Date.now()
): string | null => {
  if (openedAt <= 0) {
    return null;
  }

  const date = new Date(openedAt);
  const current = new Date(now);
  const elapsed = now - openedAt;

  if (elapsed < minute) {
    return "刚刚";
  }

  if (elapsed < hour) {
    return `${Math.max(1, Math.floor(elapsed / minute))} 分钟前`;
  }

  if (isSameDay(date, current)) {
    return `今天 ${clock(date)}`;
  }

  if (isSameDay(date, yesterdayOf(current))) {
    return `昨天 ${clock(date)}`;
  }

  if (date.getFullYear() === current.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

export const formatRecentTimestamp = (openedAt: number): string | null => {
  if (openedAt <= 0) {
    return null;
  }

  const date = new Date(openedAt);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${clock(date)}`;
};
