'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

type ToolbarTab = 'requested-tasks' | 'checklist' | 'attachments' | 'history'

const TOOLBAR_TABS: { key: ToolbarTab; label: string }[] = [
  { key: 'requested-tasks', label: 'Requested Tasks' },
  { key: 'checklist', label: 'Checklist Tasks' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'history', label: 'File History' },
]

export function OrderToolbar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<ToolbarTab | null>(null)

  useEffect(() => {
    setActiveTab(null)
  }, [pathname])

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="order-toolbar">
        {TOOLBAR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-testid={`toolbar-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-sm ${
              activeTab === tab.key
                ? 'border-b-2 border-slate-900 font-medium text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab ? (
        <p className="text-sm text-slate-500" data-testid="toolbar-placeholder">
          Not built yet.
        </p>
      ) : (
        children
      )}
    </div>
  )
}
