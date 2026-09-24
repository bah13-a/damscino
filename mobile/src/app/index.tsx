import { Redirect } from 'expo-router';
import { homeOf, useSession } from '@/lib/useSession';

export default function Index() {
  return <Redirect href={homeOf(useSession())} />;
}
