import type { FC } from 'react';
import ConfigForm from '@/components/configForm';
import type { ServerInfo } from '@/types';

interface Props {
  serverInfo: ServerInfo;
}

const ConfigFormPage: FC<Props> = ({ serverInfo }) => {
  const { protocol, hostname } = window.location;
  const isSecure =
    protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

  return <ConfigForm serverInfo={serverInfo} insecure={!isSecure} />;
};

export default ConfigFormPage;
