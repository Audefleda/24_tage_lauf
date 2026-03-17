import { redirect } from 'next/navigation'

// Root redirects to runs page (auth handled by middleware)
export default function Home() {
  redirect('/runs')
}
