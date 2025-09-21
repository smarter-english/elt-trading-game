// seed-headlines.js
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import headlines from './headlines.js';

// 1) Initialize your app (reuse your Firebase config)
const firebaseConfig = {
  apiKey: 'AIzaSyArP6OOE39Zn_vJNpNETnEdaIKfcivVpIY',
  authDomain: 'elt-trading-game.firebaseapp.com',
  databaseURL: 'https://elt-trading-game-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'elt-trading-game',
  storageBucket: 'elt-trading-game.firebasestorage.app',
  messagingSenderId: '723541641523',
  appId: '1:723541641523:web:b5013f3051ddcea1aa5646',
  measurementId: 'G-DG8E6CTHB6',
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/**
 * Seed headlines for one round.
 * This will overwrite each entry at
 * constants/headlines/{round}/{i} without
 * deleting any other nodes.
 */
async function seedRound(round) {
  for (let i = 0; i < headlines.length; i++) {
    const { text, commodity, change } = headlines[i];
    await set(ref(db, `constants/headlines/${round}/${i}`), { text, commodity, change });
    console.log(`  - Wrote headline[${i}] →`, headlines[i]);
  }
  console.log(`✅ Finished seeding round ${round}`);
}

seedRound(4).catch((err) => {
  console.error('❌ Error seeding headlines:', err);
  process.exit(1);
});
