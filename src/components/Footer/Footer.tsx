import CameraSelect from 'components/CameraSelect';
import MainRecordButton from 'components/MainRecordButton';
import MicrophoneSelect from 'components/MicrophoneSelect';
import ShapeSelect from 'components/ShapeSelect';
import { useState } from 'react';
import Teleprompter from 'components/Teleprompter';

import styles from './Footer.module.css';

const Footer = () => {
  const [showTeleprompter, setShowTeleprompter] = useState(false);
  return (
    <footer className={styles.root}>
      <div>&nbsp;</div>
      <MainRecordButton />
      <div className={styles.devices}>
        <button
          onClick={() => setShowTeleprompter(!showTeleprompter)}
          className={styles.teleprompterButton}
        >
          {showTeleprompter ? 'Hide' : 'Show'} Teleprompter
        </button>
        {showTeleprompter && <Teleprompter />}
        <ShapeSelect />
        <MicrophoneSelect />
        <CameraSelect />
      </div>
    </footer>
  );
};

export default Footer;
