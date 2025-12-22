'use client';

import { CopilotKit } from '@copilotkit/react-core';
import { ReactNode } from 'react';

interface CopilotKitProviderProps {
  children: ReactNode;
}

export function CopilotKitProvider({ children }: CopilotKitProviderProps) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent="supervisor"
      showDevConsole={process.env.NODE_ENV === 'development'}
    >
      {children}
    </CopilotKit>
  );
}
