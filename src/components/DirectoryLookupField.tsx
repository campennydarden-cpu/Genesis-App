'use client'

import { useState, useTransition } from 'react'
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { searchEntityDirectory } from '@/app/actions/entity-directory'
import type { EntityDirectoryRecord, EntityDirectoryRoleType } from '@/lib/types'

export function DirectoryLookupField({
  roleType,
  onSelected,
  onAddNew,
}: {
  roleType: EntityDirectoryRoleType
  onSelected: (record: EntityDirectoryRecord) => void
  onAddNew: (name: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EntityDirectoryRecord[]>([])
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleQueryChange(value: string) {
    setQuery(value)
    setOpen(true)
    startTransition(async () => {
      const found = await searchEntityDirectory(roleType, value)
      setResults(found)
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<div />}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={`Search ${roleType.toLowerCase()}s or add new…`}
            value={query}
            onValueChange={handleQueryChange}
          />
        </Command>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            {isPending && <CommandItem disabled>Searching…</CommandItem>}
            {!isPending &&
              results.map((record) => (
                <CommandItem
                  key={record.id}
                  value={record.id}
                  onSelect={() => {
                    onSelected(record)
                    setOpen(false)
                  }}
                >
                  {record.name} <span className="ml-2 text-xs text-slate-500">{record.lookup_code}</span>
                </CommandItem>
              ))}
            {!isPending && query.trim().length > 0 && (
              <CommandItem
                value={`add-new-${query}`}
                onSelect={() => {
                  onAddNew(query)
                  setOpen(false)
                }}
              >
                Add &quot;{query}&quot; as new
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
