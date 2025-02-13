import CameraSelect from 'components/CameraSelect';
import MainRecordButton from 'components/MainRecordButton';
import MicrophoneSelect from 'components/MicrophoneSelect';

import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.root}>
      <div>&nbsp;</div>
      <MainRecordButton />
      <div className={styles.devices}>
        <MicrophoneSelect />
        <CameraSelect />
      </div>
    </footer>
  );
};

export default Footer;
