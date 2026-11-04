'use client'

import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'

// À n'afficher que pour une session du personnel : useClerk() exige que le
// fournisseur Clerk soit monté, ce qui est toujours le cas quand une telle
// session existe.
export function StaffSignOutButton({
  redirectUrl = '/',
  variant = 'ghost',
  label,
}: {
  redirectUrl?: string
  variant?: 'ghost' | 'outline'
  label?: string
}) {
  const { signOut } = useClerk()

  return (
    <Button
      type="button"
      variant={variant}
      size={label ? 'default' : 'icon-sm'}
      aria-label="Se déconnecter"
      onClick={() => signOut({ redirectUrl })}
    >
      <LogOut className="size-3.5" />
      {label}
    </Button>
  )
}
