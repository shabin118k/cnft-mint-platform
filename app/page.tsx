'use client'

import { useState } from 'react'
import WalletConnect from '@/components/WalletConnect'
import MintForm from '@/components/MintForm'

export default function Home() {
  const [walletInfo, setWalletInfo] = useState<{
    address: string
    walletKey: string
    walletApi: any
  } | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            CNFTミントアプリケーション
          </h1>
          <p className="text-xl text-gray-600">
            Cardano NFTを簡単にミントできます
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <WalletConnect
            onConnect={(info) => {
              setWalletInfo(info)
              setIsConnected(true)
            }}
            onDisconnect={() => {
              setWalletInfo(null)
              setIsConnected(false)
            }}
          />
        </div>

        {isConnected && walletInfo && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                ウォレット接続済み
              </h2>
              <p className="text-sm text-gray-500 break-all">
                {walletInfo.address}
              </p>
            </div>
            <MintForm
              walletAddress={walletInfo.address}
              walletKey={walletInfo.walletKey}
              walletApi={walletInfo.walletApi}
            />
          </div>
        )}

        {!isConnected && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <p className="text-gray-600">
              ウォレットを接続してNFTをミントしてください
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

