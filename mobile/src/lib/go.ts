// Moving around the app. Main pages (Home, the tabs, the profile panel's pages, Start-menu links) replace the
// current screen, so switching never piles screens up; deeper screens (forms, the clock-in screen) open on top,
// so their ‹ back returns to where you were.
import { router } from 'expo-router';

/** Forms and the clock-in screen: /…/new, /…/fix, /employee/clock. */
export const isDeep = (to: string) => /\/(new|fix|clock)(\?|$)/.test(to);

export function go(to: string) {
  if (isDeep(to)) router.push(to as never);
  else router.replace(to as never);
}
