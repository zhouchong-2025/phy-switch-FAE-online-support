'use client'

import { useState } from 'react'
import ChatInterface from '@/components/ChatInterface'
import SchematicUploader from '@/components/SchematicUploader'
import Header from '@/components/Header'

type Tab = 'chat' | 'schematic'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('chat')

  return (
    <main className="min-h-screen flex flex-col">
      <Header />

      {/* Tab 切换 */}
      <div className="bg-gray-900/50 border-b border-gray-700">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === 'chat'
                  ? 'text-primary-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              💬 技术咨询
              {activeTab === 'chat' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('schematic')}
              className={`px-6 py-3 font-medium transition-all relative ${
                activeTab === 'schematic'
                  ? 'text-primary-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              📄 原理图分析
              {activeTab === 'schematic' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {activeTab === 'chat' ? <ChatInterface /> : <SchematicUploader />}
      </div>
    </main>
  )
}
