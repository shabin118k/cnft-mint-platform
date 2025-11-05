'use client'

import { useState, useEffect } from 'react'
import { getWallet } from '@/utils/cardano'
import { mintNFT } from '@/utils/nftMint'
import { testIPFSConnection } from '@/utils/ipfs'

interface MintFormProps {
  walletAddress: string
  walletKey: string
  walletApi?: any
}

export default function MintForm({ walletAddress, walletKey, walletApi }: MintFormProps) {
  // よく使うCIP-25(721)内のキーのプリセット
  const CUSTOM_FIELD_PRESETS: Array<{ label: string; key: string; type: 'string' | 'number' | 'boolean'; value: string }> = [
    { label: 'attributes(JSON文字列)', key: 'attributes', type: 'string', value: '{"rarity":"legendary"}' },
    { label: 'traits(JSON文字列)', key: 'traits', type: 'string', value: '[{"trait_type":"Background","value":"Blue"}]' },
    { label: 'external_url', key: 'external_url', type: 'string', value: 'https://example.com' },
    { label: 'website', key: 'website', type: 'string', value: 'https://example.com' },
    { label: 'twitter', key: 'twitter', type: 'string', value: 'https://x.com/yourhandle' },
    { label: 'discord', key: 'discord', type: 'string', value: 'https://discord.gg/yourinvite' },
    { label: 'instagram', key: 'instagram', type: 'string', value: 'https://instagram.com/yourhandle' },
    { label: 'artist', key: 'artist', type: 'string', value: 'Unknown Artist' },
    { label: 'creator', key: 'creator', type: 'string', value: 'Your Name' },
    { label: 'creators(JSON文字列)', key: 'creators', type: 'string', value: '["Alice","Bob"]' },
    { label: 'publisher', key: 'publisher', type: 'string', value: 'Your Studio' },
    { label: 'collection', key: 'collection', type: 'string', value: 'My Collection' },
    { label: 'series', key: 'series', type: 'string', value: 'Series 1' },
    { label: 'edition(番号)', key: 'edition', type: 'number', value: '1' },
    { label: 'license', key: 'license', type: 'string', value: 'CC BY-NC 4.0' },
    { label: 'copyright', key: 'copyright', type: 'string', value: '© 2025 Your Name' },
    { label: 'compiler', key: 'compiler', type: 'string', value: 'Custom Toolchain' },
    { label: 'background_color', key: 'background_color', type: 'string', value: '#FFFFFF' },
    { label: 'banner_image', key: 'banner_image', type: 'string', value: 'ipfs://...' },
    { label: 'thumbnail', key: 'thumbnail', type: 'string', value: 'ipfs://...' },
    { label: 'mimeType (mediaTypeの別名)', key: 'mimeType', type: 'string', value: 'image/png' },
    { label: 'files(JSON文字列)', key: 'files', type: 'string', value: '[{"name":"image","mediaType":"image/png","src":"ipfs://..."}]' },
  ]

  // よく使う任意ラベルのプリセット（数値ラベル）
  const EXTRA_LABEL_PRESETS: Array<{ label: string; code: string; type: 'string' | 'number' | 'boolean' | 'json'; value: string }> = [
    { label: '2048: notes(例)', code: '2048', type: 'json', value: '{"note":"hello"}' },
    { label: '3000: attributes(例)', code: '3000', type: 'json', value: '{"strength":10,"lucky":true}' },
    { label: '777: creator', code: '777', type: 'string', value: 'Your Name' },
  ]
  const [nftName, setNftName] = useState('Sample CNFT')
  const [nftDescription, setNftDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isMinting, setIsMinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [imageCid, setImageCid] = useState<string | null>(null)
  const [metadataCid, setMetadataCid] = useState<string | null>(null)
  const [ipfsStatus, setIpfsStatus] = useState<{ connected: boolean; version?: string; error?: string } | null>(null)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [generateNewPolicy, setGenerateNewPolicy] = useState(true)
  const [policyExpiryHours, setPolicyExpiryHours] = useState<number>(1)
  const [policyId, setPolicyId] = useState<string>('')
  const [policyKeyPair, setPolicyKeyPair] = useState<{ privateKey: string; publicKey: string; policyKeyHash: string } | null>(null)
  const [storedPolicyScriptHex, setStoredPolicyScriptHex] = useState<string | null>(null)
  const [lastMintUsedNewPolicy, setLastMintUsedNewPolicy] = useState(false)
  const [connectedWallet, setConnectedWallet] = useState<any | null>(walletApi ?? null)
  const [customFieldRows, setCustomFieldRows] = useState<Array<{ key: string; type: 'string' | 'number' | 'boolean'; value: string }>>([
    { key: '', type: 'string', value: '' },
  ])
  const [extraMetaRows, setExtraMetaRows] = useState<Array<{ label: string; type: 'string' | 'number' | 'boolean' | 'json'; value: string }>>([
    { label: '', type: 'string', value: '' },
  ])
  const [royaltyRows, setRoyaltyRows] = useState<Array<{ addr: string; rate: string }>>([
    { addr: '', rate: '' },
  ])
  const [category, setCategory] = useState<'image' | 'audio' | 'video' | ''>('')
  const [useCip68, setUseCip68] = useState(true)
  const [cip68BaseName, setCip68BaseName] = useState('')

  const CATEGORY_PRESETS: Record<'image' | 'audio' | 'video', Array<{ key: string; type: 'string' | 'number' | 'boolean'; value: string }>> = {
    image: [
      { key: 'mimeType', type: 'string', value: 'image/png' },
      { key: 'files', type: 'string', value: '[{"name":"image","mediaType":"image/png","src":"ipfs://..."}]' },
      { key: 'thumbnail', type: 'string', value: 'ipfs://...' },
      { key: 'attributes', type: 'string', value: '{"rarity":"common"}' },
    ],
    audio: [
      { key: 'mimeType', type: 'string', value: 'audio/mpeg' },
      { key: 'files', type: 'string', value: '[{"name":"audio","mediaType":"audio/mpeg","src":"ipfs://..."}]' },
      { key: 'thumbnail', type: 'string', value: 'ipfs://...' },
      { key: 'attributes', type: 'string', value: '{"duration":"180"}' },
    ],
    video: [
      { key: 'mimeType', type: 'string', value: 'video/mp4' },
      { key: 'files', type: 'string', value: '[{"name":"video","mediaType":"video/mp4","src":"ipfs://..."}]' },
      { key: 'thumbnail', type: 'string', value: 'ipfs://...' },
      { key: 'attributes', type: 'string', value: '{"resolution":"1920x1080"}' },
    ],
  }

  function applyCategoryPreset(kind: 'image' | 'audio' | 'video') {
    const base = CATEGORY_PRESETS[kind]
    // 既存行を残しつつ、同名キーは上書き
    const map = new Map<string, { key: string; type: 'string' | 'number' | 'boolean'; value: string }>()
    for (const r of customFieldRows) map.set(r.key, r)
    for (const r of base) map.set(r.key, r)
    setCustomFieldRows(Array.from(map.values()))
  }

  function buildCustomFields(): Record<string, any> | undefined {
    const result: Record<string, any> = {}
    let hasAny = false
    for (const row of customFieldRows) {
      const k = row.key.trim()
      if (!k) continue
      let v: any = row.value
      if (row.type === 'number') {
        const n = Number(v)
        if (!Number.isFinite(n)) throw new Error(`カスタムフィールド「${k}」は数値を入力してください`)
        v = n
      } else if (row.type === 'boolean') {
        v = row.value === 'true'
      }
      result[k] = v
      hasAny = true
    }
    return hasAny ? result : undefined
  }

  function buildExtraMetadata(): Record<string, any> | undefined {
    const result: Record<string, any> = {}
    let hasAny = false
    for (const row of extraMetaRows) {
      const label = row.label.trim()
      if (!label) continue
      if (!/^\d+$/.test(label)) throw new Error(`任意メタデータのラベルは数値にしてください: ${label}`)
      let v: any = row.value
      if (row.type === 'number') {
        const n = Number(v)
        if (!Number.isFinite(n)) throw new Error(`ラベル ${label} の値は数値が必要です`)
        v = n
      } else if (row.type === 'boolean') {
        v = row.value === 'true'
      } else if (row.type === 'json') {
        try {
          v = JSON.parse(row.value || 'null')
        } catch (e: any) {
          throw new Error(`ラベル ${label} のJSON解析に失敗: ${e.message || e}`)
        }
      }
      result[label] = v
      hasAny = true
    }
    return hasAny ? result : undefined
  }

  function buildCIP27Royalty(): Record<string, any> | undefined {
    const list: Array<{ addr: string; rate: number }> = []
    for (const r of royaltyRows) {
      const addr = r.addr.trim()
      const rateInt = parseInt((r.rate || '').trim(), 10)
      if (!addr && !r.rate) continue
      if (!addr) throw new Error('ロイヤリティのアドレスを入力してください')
      if (!Number.isFinite(rateInt) || rateInt < 1 || rateInt > 100) {
        throw new Error('ロイヤリティ率は1〜100の整数で入力してください（例: 5）')
      }
      const rateFraction = rateInt / 100
      list.push({ addr, rate: rateFraction })
    }
    if (list.length === 0) return undefined
    return { '777': list }
  }

  // IPFS接続状態をテスト（環境変数から取得）
  const testConnection = async () => {
    setIsTestingConnection(true)
    try {
      // 環境変数はサーバーサイドでのみ使用（クライアントからは送信しない）
      const status = await testIPFSConnection()
      setIpfsStatus(status)
    } catch (error: any) {
      setIpfsStatus({
        connected: false,
        error: error.message || '接続テストに失敗しました',
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  // コンポーネントマウント時に接続をテスト
  useEffect(() => {
    testConnection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // WalletConnectから渡されたwalletApiが変わった場合に反映
  useEffect(() => {
    if (walletApi) {
      setConnectedWallet(walletApi)
    }
  }, [walletApi])

  const ensureWallet = async () => {
    if (connectedWallet) {
      return connectedWallet
    }

    if (!walletKey) {
      throw new Error('ウォレット情報が見つかりません。再度接続してください。')
    }

    const enabledWallet = await getWallet(walletKey)
    setConnectedWallet(enabledWallet)
    return enabledWallet
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('ファイルサイズは10MB以下にしてください')
        return
      }
      if (!file.type.startsWith('image/') && !file.type.startsWith('audio/') && file.name.toLowerCase().endsWith('.mp3') === false) {
        setError('画像ファイルまたは音声ファイル（mp3）を選択してください')
        return
      }
      setImageFile(file)
      // 画像の場合のみプレビューを表示
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setImagePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        // 音声ファイルの場合はプレビューをクリア
        setImagePreview(null)
      }
      setError(null)
    }
  }

  const handleMint = async () => {
    if (!nftName.trim()) {
      setError('NFT名を入力してください')
      return
    }

    if (!imageFile) {
      setError('画像または音声ファイルを選択してください')
      return
    }

    if (!generateNewPolicy) {
      if (!policyId.trim()) {
        setError('既存のポリシーIDを入力してください')
        return
      }

      if (!policyKeyPair || !storedPolicyScriptHex) {
        setError('既存ポリシーの秘密鍵とスクリプト情報が見つかりません。新しいポリシーIDを生成してください。')
        return
      }
    }

    setIsMinting(true)
    setError(null)
    setSuccess(null)
    setTxHash(null)
    setProgress(null)
    setImageCid(null)
    setMetadataCid(null)
    setLastMintUsedNewPolicy(false)

    try {
      // Cardanoウォレットの取得
      const wallet = await ensureWallet()

      // NFTをミント（IPFSアップロードを含む）
      // IPFS URLはサーバーサイドの環境変数から取得
      const userExtra = buildExtraMetadata()
      const cip27 = buildCIP27Royalty()
      const mergedExtra = (() => {
        if (userExtra && cip27) return { ...userExtra, ...cip27 }
        return userExtra || cip27
      })()

      const result = await mintNFT({
        wallet,
        nftName: nftName.trim(),
        description: nftDescription.trim(),
        imageFile,
        policyId: policyId.trim() || undefined,
        generateNewPolicy: generateNewPolicy,
        policyExpiryHours: generateNewPolicy ? policyExpiryHours : undefined,
        policyScriptHex: !generateNewPolicy ? storedPolicyScriptHex ?? undefined : undefined,
        policyPrivateKeyHex: !generateNewPolicy ? policyKeyPair?.privateKey : undefined,
        // 任意メタデータ（行入力から構築）
        customFields: buildCustomFields(),
        extraMetadata: mergedExtra,
        cip68: useCip68
          ? {
              enabled: true,
              baseName: (cip68BaseName || nftName).trim(),
            }
          : undefined,
        onProgress: (progress: { stage: string; message: string }) => {
          setProgress(progress.message)
        },
      } as any)

      setLastMintUsedNewPolicy(generateNewPolicy)
      setTxHash(result.transactionHash)
      setImageCid(result.imageCid)
      setMetadataCid(result.metadataCid)
      setProgress(null)
      setSuccess('NFTミントが成功しました！トランザクションを確認してください。')
      
      // ポリシーIDを保存（次回使用するため）
      if (result.policyId) {
        setPolicyId(result.policyId)
      }

      if (result.keyPair) {
        setPolicyKeyPair(result.keyPair)
      }

      if (result.policyScriptHex) {
        setStoredPolicyScriptHex(result.policyScriptHex)
      }
      
      // フォームをリセット
      setNftName('')
      setNftDescription('')
      setImageFile(null)
      setImagePreview(null)

    } catch (err: any) {
      console.error('ミントエラー:', err)
      setError(err.message || 'NFTミントに失敗しました')
      setProgress(null)
    } finally {
      setIsMinting(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        NFTをミント
      </h2>

      <div className="space-y-6">
        <div>
          <label htmlFor="nftName" className="block text-sm font-medium text-gray-700 mb-2">
            NFT名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="nftName"
            value={nftName}
            onChange={(e) => setNftName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cardano-primary focus:border-transparent"
            placeholder="例: My Awesome NFT"
          />
        </div>

        <div>
          <label htmlFor="nftDescription" className="block text-sm font-medium text-gray-700 mb-2">
            説明
          </label>
          <textarea
            id="nftDescription"
            value={nftDescription}
            onChange={(e) => setNftDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cardano-primary focus:border-transparent"
            placeholder="NFTの説明を入力してください"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Kubo RPCサーバー接続状態
            </label>
            <button
              type="button"
              onClick={testConnection}
              disabled={isTestingConnection}
              className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 disabled:opacity-50"
            >
              {isTestingConnection ? 'テスト中...' : '接続テスト'}
            </button>
          </div>
          {ipfsStatus && (
            <div className={`mb-4 p-3 rounded text-sm ${
              ipfsStatus.connected
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {ipfsStatus.connected ? (
                <div>
                  <span className="font-semibold">✓ Kubo RPC接続成功</span>
                  {ipfsStatus.version && (
                    <span className="ml-2 text-xs">(v{ipfsStatus.version})</span>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-line">
                  <span className="font-semibold">✗ 接続失敗:</span>
                  <div className="mt-1 text-xs">{ipfsStatus.error || 'Kubo RPCサーバーに接続できません'}</div>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-gray-500">
            Kubo RPCサーバーのURLは環境変数（IPFS_URL）から自動的に取得されます
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">カテゴリー プリセット</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <select
                value={category}
                onChange={(e) => setCategory((e.target.value as any) || '')}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="">選択してください</option>
                <option value="image">画像NFT（image/png想定）</option>
                <option value="audio">音声NFT（audio/mpeg想定）</option>
                <option value="video">動画NFT（video/mp4想定）</option>
              </select>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                disabled={!category}
                onClick={() => category && applyCategoryPreset(category)}
                className="w-full md:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
              >
                カテゴリーを適用
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">選択したカテゴリーに合わせて 721 内の推奨フィールド（files / mimeType / thumbnail / attributes）を一括設定します。値は後から編集できます。</p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">CIP-68（参照NFTミント）</h3>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                id="useCip68"
                type="checkbox"
                checked={useCip68}
                onChange={(e) => setUseCip68(e.target.checked)}
                className="h-4 w-4 text-cardano-primary focus:ring-cardano-primary border-gray-300 rounded"
              />
              <label htmlFor="useCip68" className="ml-2 block text-sm text-gray-700">
                CIP-68方式でミントする（.ref/.nft ペア、インラインDatumはCIP-25互換）
              </label>
            </div>
            {useCip68 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ベース名（省略時はNFT名を使用）</label>
                <input
                  type="text"
                  value={cip68BaseName}
                  onChange={(e) => setCip68BaseName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cardano-primary focus:border-transparent"
                  placeholder="例: MyAsset"
                />
                <p className="text-xs text-gray-500 mt-1">.ref はスクリプトアドレスへ、.nft はあなたのアドレスへ送付します。</p>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            ポリシーID設定
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="generateNewPolicy"
                checked={generateNewPolicy}
                onChange={(e) => {
                  const nextValue = e.target.checked
                  setGenerateNewPolicy(nextValue)
                  if (nextValue) {
                    setPolicyKeyPair(null)
                    setStoredPolicyScriptHex(null)
                  }
                }}
                className="h-4 w-4 text-cardano-primary focus:ring-cardano-primary border-gray-300 rounded"
              />
              <label htmlFor="generateNewPolicy" className="ml-2 block text-sm text-gray-700">
                新しいポリシーIDを生成する
              </label>
            </div>

            {!generateNewPolicy && (
              <div>
                <label htmlFor="policyId" className="block text-sm font-medium text-gray-700 mb-2">
                  既存のポリシーID（オプション）
                </label>
                <input
                  type="text"
                  id="policyId"
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cardano-primary focus:border-transparent"
                  placeholder="既存のポリシーIDを入力（空の場合は自動生成）"
                />
                <p className="text-xs text-gray-500 mt-1">
                  既存のポリシーIDを入力すると、同じポリシーで複数のNFTをミントできます
                </p>
                {policyKeyPair && storedPolicyScriptHex && (
                  <p className="text-xs text-gray-500 mt-1">
                    このブラウザには前回生成したポリシーの秘密鍵とスクリプトが保存されています。
                  </p>
                )}
              </div>
            )}

            {generateNewPolicy && (
              <div>
                <label htmlFor="policyExpiryHours" className="block text-sm font-medium text-gray-700 mb-2">
                  ポリシーの有効期限（時間）
                </label>
                <input
                  type="number"
                  id="policyExpiryHours"
                  value={policyExpiryHours}
                  onChange={(e) => setPolicyExpiryHours(Number(e.target.value) || 1)}
                  min="1"
                  max="8760"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cardano-primary focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ポリシーの有効期限を設定します（デフォルト: 1時間、最大: 1年）
                </p>
              </div>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="imageFile" className="block text-sm font-medium text-gray-700 mb-2">
            画像・音声 <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            id="imageFile"
            accept="image/*,audio/*,.mp3"
            onChange={handleImageChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cardano-primary focus:border-transparent"
          />
          {imagePreview && (
            <div className="mt-4">
              <img
                src={imagePreview}
                alt="プレビュー"
                className="max-w-xs rounded-lg shadow-md"
              />
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            メタデータ（任意項目）
          </h3>
          <div className="grid grid-cols-1 gap-6">
            {/* 721内の追加フィールド */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  721内の追加フィールド
                </label>
                <button
                  type="button"
                  onClick={() => setCustomFieldRows((rows) => [...rows, { key: '', type: 'string', value: '' }])}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  行を追加
                </button>
              </div>
              <div className="space-y-2">
                {customFieldRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <select
                      onChange={(e) => {
                        const preset = CUSTOM_FIELD_PRESETS.find(p => p.label === e.target.value)
                        if (!preset) return
                        setCustomFieldRows((rows) => rows.map((r, i) => i === idx ? { key: preset.key, type: preset.type, value: preset.value } : r))
                      }}
                      className="col-span-12 md:col-span-12 px-3 py-2 border border-gray-300 rounded md:hidden"
                      defaultValue=""
                    >
                      <option value="" disabled>プリセットを選択</option>
                      {CUSTOM_FIELD_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="キー (例: attributes)"
                      value={row.key}
                      onChange={(e) => {
                        const v = e.target.value
                        setCustomFieldRows((rows) => rows.map((r, i) => i === idx ? { ...r, key: v } : r))
                      }}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded hidden md:block"
                    />
                    <select
                      onChange={(e) => {
                        const preset = CUSTOM_FIELD_PRESETS.find(p => p.label === e.target.value)
                        if (!preset) return
                        setCustomFieldRows((rows) => rows.map((r, i) => i === idx ? { key: preset.key, type: preset.type, value: preset.value } : r))
                      }}
                      className="col-span-3 px-3 py-2 border border-gray-300 rounded hidden md:block"
                      defaultValue=""
                    >
                      <option value="" disabled>プリセット</option>
                      {CUSTOM_FIELD_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    <select
                      value={row.type}
                      onChange={(e) => {
                        const t = e.target.value as 'string' | 'number' | 'boolean'
                        setCustomFieldRows((rows) => rows.map((r, i) => i === idx ? { ...r, type: t } : r))
                      }}
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                    </select>
                    <input
                      type="text"
                      placeholder="値"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value
                        setCustomFieldRows((rows) => rows.map((r, i) => i === idx ? { ...r, value: v } : r))
                      }}
                      className="col-span-4 px-3 py-2 border border-gray-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomFieldRows((rows) => rows.filter((_, i) => i !== idx))}
                      className="col-span-1 px-2 py-2 bg-red-50 text-red-600 border border-red-200 rounded"
                      aria-label="remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                例: key=attributes, type=string, value='<code>{"{\"rarity\":\"legendary\"}"}</code>' のように文字列として渡してもOKです。
              </p>
            </div>

            {/* 任意ラベルのオンチェーンメタデータ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  任意ラベルのオンチェーンメタデータ
                </label>
                <button
                  type="button"
                  onClick={() => setExtraMetaRows((rows) => [...rows, { label: '', type: 'string', value: '' }])}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  行を追加
                </button>
              </div>
              <div className="space-y-2">
                {extraMetaRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <select
                      onChange={(e) => {
                        const preset = EXTRA_LABEL_PRESETS.find(p => p.label === e.target.value)
                        if (!preset) return
                        setExtraMetaRows((rows) => rows.map((r, i) => i === idx ? { label: preset.code, type: preset.type, value: preset.value } : r))
                      }}
                      className="col-span-12 md:col-span-12 px-3 py-2 border border-gray-300 rounded md:hidden"
                      defaultValue=""
                    >
                      <option value="" disabled>プリセットを選択</option>
                      {EXTRA_LABEL_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="ラベル(数値) 例: 2048"
                      value={row.label}
                      onChange={(e) => {
                        const v = e.target.value
                        setExtraMetaRows((rows) => rows.map((r, i) => i === idx ? { ...r, label: v } : r))
                      }}
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded hidden md:block"
                    />
                    <select
                      onChange={(e) => {
                        const preset = EXTRA_LABEL_PRESETS.find(p => p.label === e.target.value)
                        if (!preset) return
                        setExtraMetaRows((rows) => rows.map((r, i) => i === idx ? { label: preset.code, type: preset.type, value: preset.value } : r))
                      }}
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded hidden md:block"
                      defaultValue=""
                    >
                      <option value="" disabled>プリセット</option>
                      {EXTRA_LABEL_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    <select
                      value={row.type}
                      onChange={(e) => {
                        const t = e.target.value as 'string' | 'number' | 'boolean' | 'json'
                        setExtraMetaRows((rows) => rows.map((r, i) => i === idx ? { ...r, type: t } : r))
                      }}
                      className="col-span-2 px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="json">json</option>
                    </select>
                    <input
                      type="text"
                      placeholder="値（jsonは有効なJSON）"
                      value={row.value}
                      onChange={(e) => {
                        const v = e.target.value
                        setExtraMetaRows((rows) => rows.map((r, i) => i === idx ? { ...r, value: v } : r))
                      }}
                      className="col-span-6 px-3 py-2 border border-gray-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => setExtraMetaRows((rows) => rows.filter((_, i) => i !== idx))}
                      className="col-span-1 px-2 py-2 bg-red-50 text-red-600 border border-red-200 rounded"
                      aria-label="remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ラベルは数値（例: 2048）。型がjsonのときは有効なJSONを入力してください。
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            CIP-27 ロイヤリティ
          </h3>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-600">ラベル <code>777</code> に {"{"}addr, rate{"}"} の配列を格納します（rateは1〜100の整数%を0〜1へ変換）。</p>
            <button
              type="button"
              onClick={() => setRoyaltyRows((rows) => [...rows, { addr: '', rate: '' }])}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
            >
              行を追加
            </button>
          </div>
          <div className="space-y-2">
            {royaltyRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  placeholder="支払いアドレス（addr1...）"
                  value={row.addr}
                  onChange={(e) => {
                    const v = e.target.value
                    setRoyaltyRows((rows) => rows.map((r, i) => i === idx ? { ...r, addr: v } : r))
                  }}
                  className="col-span-8 px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  placeholder="率 (例: 5)"
                  value={row.rate}
                  onChange={(e) => {
                    const v = e.target.value
                    setRoyaltyRows((rows) => rows.map((r, i) => i === idx ? { ...r, rate: v } : r))
                  }}
                  className="col-span-3 px-3 py-2 border border-gray-300 rounded"
                />
                <button
                  type="button"
                  onClick={() => setRoyaltyRows((rows) => rows.filter((_, i) => i !== idx))}
                  className="col-span-1 px-2 py-2 bg-red-50 text-red-600 border border-red-200 rounded"
                  aria-label="remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">複数の受取先を追加できます。rateの合計は100以下（= 100%以下）にすることを推奨します。</p>
        </div>

        {progress && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-blue-600 text-sm">{progress}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-600 text-sm font-semibold mb-2">{success}</p>
            {policyId && (
              <p className="text-green-600 text-xs break-all mb-1">
                ポリシーID: {policyId}
              </p>
            )}
            {imageCid && (
              <p className="text-green-600 text-xs break-all mb-1">
                画像IPFS CID: {imageCid}
              </p>
            )}
            {metadataCid && (
              <p className="text-green-600 text-xs break-all mb-1">
                メタデータIPFS CID: {metadataCid}
              </p>
            )}
            {txHash && (
              <p className="text-green-600 text-xs break-all">
                トランザクションハッシュ: {txHash}
              </p>
            )}
            {lastMintUsedNewPolicy && policyKeyPair && storedPolicyScriptHex && (
              <div className="mt-3 pt-3 border-t border-green-200 space-y-2">
                <p className="text-green-700 text-xs font-semibold">
                  新しいポリシー情報（安全な場所に保管してください）
                </p>
                <div>
                  <label className="block text-[11px] text-green-700 font-medium mb-1">
                    ポリシー秘密鍵（hex）
                  </label>
                  <textarea
                    readOnly
                    value={policyKeyPair.privateKey}
                    className="w-full text-xs font-mono bg-white border border-green-200 rounded-md p-2 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-green-700 font-medium mb-1">
                    ポリシースクリプト（hex）
                  </label>
                  <textarea
                    readOnly
                    value={storedPolicyScriptHex}
                    className="w-full text-xs font-mono bg-white border border-green-200 rounded-md p-2 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleMint}
          disabled={isMinting || !nftName.trim() || !imageFile}
          className="w-full bg-gradient-to-r from-cardano-primary to-cardano-secondary text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
        >
          {isMinting ? 'ミント中...' : 'NFTをミント'}
        </button>
      </div>
    </div>
  )
}

