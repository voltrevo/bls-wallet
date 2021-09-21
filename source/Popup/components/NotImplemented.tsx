import * as React from 'react';
import App from '../App';

import Button from './Button';

export default function NotImplemented(app: App): void {
  app.events.emit('overlay', (close) => (
    <>
      <div style={{ marginBottom: '12px' }}>Not implemented</div>
      <Button highlight={true} onPress={close}>
        Ok
      </Button>
    </>
  ));
}
