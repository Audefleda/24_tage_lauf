import { redirect } from 'next/navigation'

// PROJ-4 redesign: inline editing in the table replaced the separate edit page.
// This redirect ensures any old bookmarks or links still work.
export default function EditRunPage() {
  redirect('/runs')
}
