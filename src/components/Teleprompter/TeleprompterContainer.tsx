'use client';

import { Teleprompter } from './Teleprompter';
import styles from './TeleprompterContainer.module.css';

export function TeleprompterContainer() {
  return (
    <div className={styles.container}>
      <Teleprompter />
    </div>
  );
}
