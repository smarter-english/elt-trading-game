import { ref, update, set, push } from 'firebase/database';
import { database, auth } from './firebase';
import commodities from './commodities';
import headlines from './headlines';


/**
 * Write the entire commodities array into /constants/commodities
 */
export function seedCommodities() {
  return set(ref(database, 'constants/commodities'), commodities);
}
// NEW: seed the entire headlines object under /constants/headlines
export function seedHeadlines() {
  return set(ref(database, 'constants/headlines'), headlines);
}