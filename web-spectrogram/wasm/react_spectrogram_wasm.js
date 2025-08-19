let initCount = 0;
export default async function init() {
  initCount++;
}
export async function initThreadPool() {
  initCount++;
}
export function getInitCount() {
  return initCount;
}
