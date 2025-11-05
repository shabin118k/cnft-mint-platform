'use client'

import { useState, useEffect } from 'react'

interface WalletConnectProps {
  onConnect: (params: { address: string; walletKey: string; walletApi: any }) => void
  onDisconnect: () => void
}

interface WalletInfo {
  key: string
  name: string
  icon?: string
  apiVersion?: string
  enabled?: boolean
  installed: boolean
  downloadUrl?: string
}

// 対応ウォレットの完全なリスト
const SUPPORTED_WALLETS: Omit<WalletInfo, 'installed' | 'enabled' | 'apiVersion'>[] = [
  {
    key: 'nami',
    name: 'Nami Wallet',
    icon: 'https://raw.githubusercontent.com/Berry-Pool/nami-wallet/main/assets/icon/icon-128x128.png',
    downloadUrl: 'https://namiwallet.io/',
  },
  {
    key: 'eternl',
    name: 'Eternl (ccvault.io)',
    icon: 'https://eternl.io/logo.png',
    downloadUrl: 'https://eternl.io/',
  },
  {
    key: 'flint',
    name: 'Flint Wallet',
    icon: 'https://flint-wallet.com/icon.png',
    downloadUrl: 'https://flint-wallet.com/',
  },
  {
    key: 'yoroi',
    name: 'Yoroi Wallet',
    icon: 'https://yoroi-wallet.com/images/yoroi-icon.png',
    downloadUrl: 'https://yoroi-wallet.com/',
  },
  {
    key: 'gerowallet',
    name: 'Gero Wallet',
    icon: 'https://gerowallet.io/icon.png',
    downloadUrl: 'https://gerowallet.io/',
  },
  {
    key: 'typhon',
    name: 'Typhon Wallet',
    icon: 'https://typhonwallet.io/icon.png',
    downloadUrl: 'https://typhonwallet.io/',
  },
  {
    key: 'begin',
    name: 'Begin Wallet',
    icon: 'https://begin.is/icon.png',
    downloadUrl: 'https://begin.is/',
  },
  {
    key: 'lace',
    name: 'Lace Wallet',
    icon: 'https://lace.io/icon.png',
    downloadUrl: 'https://lace.io/',
  },
  {
    key: 'vespr',
    name: 'Vespr Wallet',
    icon: 'https://vespr.xyz/icon.png',
    downloadUrl: 'https://vespr.xyz/',
  },
]

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wallets, setWallets] = useState<WalletInfo[]>([])
  const [showWalletList, setShowWalletList] = useState(false)

  // 利用可能なウォレットを検出して、対応ウォレットリストを更新
  useEffect(() => {
    const cardano = typeof window !== 'undefined' ? (window as any).cardano : null
    const installedWallets: Set<string> = new Set()

    if (cardano) {
      Object.keys(cardano).forEach((key) => {
        const wallet = cardano[key]
        if (wallet && typeof wallet.enable === 'function') {
          installedWallets.add(key)
        }
      })
    }

    // 対応ウォレットリストを構築
    const walletList: WalletInfo[] = SUPPORTED_WALLETS.map((wallet) => {
      const installed = installedWallets.has(wallet.key)
      let icon = wallet.icon
      let apiVersion: string | undefined
      let enabled: boolean | undefined

      if (installed && cardano?.[wallet.key]) {
        const walletApi = cardano[wallet.key]
        icon = walletApi.icon || wallet.icon
        apiVersion = walletApi.apiVersion
        enabled = walletApi.isEnabled ? walletApi.isEnabled() : undefined
      }

      return {
        ...wallet,
        installed,
        icon,
        apiVersion,
        enabled,
      }
    })

    // インストールされているが対応リストにないウォレットも追加
    if (cardano) {
      Object.keys(cardano).forEach((key) => {
        // 対応リストに既に存在する場合はスキップ
        if (walletList.some((w) => w.key === key)) {
          return
        }
        const wallet = cardano[key]
        if (wallet && typeof wallet.enable === 'function') {
          walletList.push({
            key,
            name: wallet.name || key,
            icon: wallet.icon,
            apiVersion: wallet.apiVersion,
            enabled: wallet.isEnabled ? wallet.isEnabled() : undefined,
            installed: true,
          })
        }
      })
    }

    setWallets(walletList)
  }, [])

  const connectWallet = async (walletKey: string) => {
    setIsConnecting(true)
    setError(null)

    try {
      const cardano = typeof window !== 'undefined' ? (window as any).cardano : null

      if (!cardano) {
        throw new Error('Cardanoウォレットが見つかりません。Cardanoウォレット拡張機能をインストールしてください。')
      }

      if (!cardano[walletKey]) {
        throw new Error(`${walletKey}ウォレットが見つかりません。拡張機能をインストールしてください。`)
      }

      const wallet = await cardano[walletKey].enable()

      if (wallet) {
        const addresses = await wallet.getUsedAddresses()
        if (addresses && addresses.length > 0) {
          onConnect({
            address: addresses[0],
            walletKey,
            walletApi: wallet,
          })
          setShowWalletList(false)
        } else {
          setError('アドレスを取得できませんでした')
        }
      } else {
        setError('ウォレットの有効化に失敗しました')
      }
    } catch (err: any) {
      console.error('ウォレット接続エラー:', err)
      setError(err.message || 'ウォレットの接続に失敗しました')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleWalletClick = async (wallet: WalletInfo) => {
    if (wallet.installed) {
      await connectWallet(wallet.key)
    } else if (wallet.downloadUrl) {
      window.open(wallet.downloadUrl, '_blank')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          ウォレット接続
        </h2>
      </div>

      {!showWalletList ? (
        <button
          onClick={() => setShowWalletList(true)}
          disabled={isConnecting}
          className="w-full bg-gradient-to-r from-cardano-primary to-cardano-secondary text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg mb-4"
        >
          ウォレットを選択
        </button>
      ) : (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              ウォレットを選択
            </h3>
            <button
              onClick={() => setShowWalletList(false)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              閉じる
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {wallets.map((wallet) => (
              <button
                key={wallet.key}
                onClick={() => handleWalletClick(wallet)}
                disabled={isConnecting && wallet.installed}
                className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all duration-200 ${
                  wallet.installed
                    ? 'border-gray-300 hover:bg-gray-50 hover:border-cardano-primary cursor-pointer'
                    : 'border-gray-200 bg-gray-50 opacity-75 hover:opacity-100 cursor-pointer'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {wallet.icon ? (
                    <img
                      src={wallet.icon}
                      alt={wallet.name}
                      className="w-10 h-10 rounded flex-shrink-0"
                      onError={(e) => {
                        // アイコンの読み込みに失敗した場合、デフォルトアイコンを表示
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          const fallback = document.createElement('div')
                          fallback.className = 'w-10 h-10 rounded bg-cardano-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0'
                          fallback.textContent = wallet.name.charAt(0).toUpperCase()
                          parent.insertBefore(fallback, e.currentTarget)
                        }
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-cardano-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {wallet.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{wallet.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {wallet.installed ? (
                        <>
                          <span className="text-xs text-green-600 font-medium">✓ インストール済み</span>
                          {wallet.apiVersion && (
                            <span className="text-xs text-gray-500">
                              API v{wallet.apiVersion}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">インストールが必要</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {isConnecting && wallet.installed ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cardano-primary"></div>
                  ) : wallet.installed ? (
                    <span className="text-xs text-cardano-primary font-medium">接続</span>
                  ) : (
                    <span className="text-xs text-gray-500">→</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {wallets.length === 0 && !showWalletList && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
          <p className="text-yellow-800 text-sm">
            Cardanoウォレット拡張機能が検出されませんでした。「ウォレットを選択」をクリックして、インストール方法を確認してください。
          </p>
        </div>
      )}
    </div>
  )
}
