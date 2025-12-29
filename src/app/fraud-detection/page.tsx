import { MainLayout } from '@/components/layout/main-layout';
import FraudDetectionClient from './fraud-detection-client';

export default function FraudDetectionPage() {
  return (
    <MainLayout>
      <FraudDetectionClient />
    </MainLayout>
  );
}
