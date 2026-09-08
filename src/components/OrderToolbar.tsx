'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { AttachmentsPanel } from '@/components/AttachmentsPanel'
import { RequestedTasksPanel } from '@/components/RequestedTasksPanel'
import { ChecklistTasksPanel } from '@/components/ChecklistTasksPanel'

type ToolbarTab = 'requested-tasks' | 'checklist' | 'attachments' | 'history'

const TOOLBAR_TABS: { key: ToolbarTab; label: string }[] = [
  { key: 'requested-tasks', label: 'Requested Tasks' },
  { key: 'checklist', label: 'Checklist Tasks' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'history', label: 'File History' },
]

export function OrderToolbar({ orderId, children }: { orderId: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const [activeTab, setActiveTab] = useState<ToolbarTab | null>(null)
  const [prevPathname, setPrevPathname] = useState(pathname)

  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setActiveTab(null)
  }

  return (
    <div>
      <div className="mb-4 flex gap-2 border-b" data-testid="order-toolbar">
        {TOOLBAR_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            data-testid={`toolbar-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`cursor-pointer px-3 py-2.5 text-sm transition-colors duration-200 ${
              activeTab === tab.key
                ? 'border-b-2 border-foreground font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'attachments' ? (
        <AttachmentsPanel orderId={orderId} />
      ) : activeTab === 'requested-tasks' ? (
        <RequestedTasksPanel orderId={orderId} />
      ) : activeTab === 'checklist' ? (
        <ChecklistTasksPanel orderId={orderId} />
      ) : activeTab ? (
        <p className="text-sm text-muted-foreground" data-testid="toolbar-placeholder">
          Not built yet.
        </p>
      ) : (
        children
      )}
    </div>
  )
}
