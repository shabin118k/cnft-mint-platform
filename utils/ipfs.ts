// クライアントサイドIPFS API呼び出しユーティリティ関数

export interface KuboRPCUploadOptions {
  pin?: boolean // ファイルをピンするかどうか（デフォルト: true）
  wrapWithDirectory?: boolean // ディレクトリでラップするかどうか
}

/**
 * サーバーサイドAPI経由でファイルをIPFSにアップロード
 * @param file アップロードするファイル
 * @param options アップロードオプション
 * @returns IPFSハッシュ（CID）
 * @remarks IPFS URLはサーバーサイドの環境変数（IPFS_URL）から取得されます
 */
export async function uploadToLocalIPFS(
  file: File,
  options: KuboRPCUploadOptions = {}
): Promise<string> {
  try {
    // FormDataを作成してサーバーサイドAPIに送信
    // IPFS URLはサーバーサイドの環境変数から取得
    const formData = new FormData()
    formData.append('file', file)
    formData.append('pin', options.pin !== false ? 'true' : 'false')
    formData.append('wrapWithDirectory', options.wrapWithDirectory ? 'true' : 'false')

    // Next.js APIルートに送信
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `IPFSアップロードに失敗しました: ${response.status}`)
    }

    const result = await response.json()
    return result.cid
  } catch (error: any) {
    console.error('IPFSアップロードエラー:', error)
    throw error
  }
}

/**
 * サーバーサイドAPI経由でメタデータJSONをIPFSにアップロード
 * @param metadata メタデータオブジェクト
 * @param options アップロードオプション
 * @returns IPFSハッシュ（CID）
 * @remarks IPFS URLはサーバーサイドの環境変数（IPFS_URL）から取得されます
 */
export async function uploadMetadataToIPFS(
  metadata: object,
  options: KuboRPCUploadOptions = {}
): Promise<string> {
  try {
    // Next.js APIルートに送信
    // IPFS URLはサーバーサイドの環境変数から取得
    const response = await fetch('/api/ipfs/upload-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata,
        options: { pin: true, ...options },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `メタデータアップロードに失敗しました: ${response.status}`)
    }

    const result = await response.json()
    return result.cid
  } catch (error: any) {
    console.error('メタデータアップロードエラー:', error)
    throw error
  }
}

/**
 * IPFSハッシュからIPFS URLを生成
 * @param cid IPFSハッシュ（CID）
 * @param gateway IPFSゲートウェイURL（デフォルト: https://ipfs.io/ipfs/）
 * @returns IPFS URL
 */
export function getIPFSUrl(
  cid: string,
  gateway: string = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
): string {
  // ipfs:// プレフィックスを削除（存在する場合）
  const cleanCid = cid.replace(/^ipfs:\/\//, '')
  return `${gateway.replace(/\/$/, '')}/${cleanCid}`
}

/**
 * サーバーサイドAPI経由でKubo RPCサーバーの接続をテスト
 * @returns 接続可能かどうか、およびバージョン情報
 * @remarks IPFS URLはサーバーサイドの環境変数（IPFS_URL）から取得されます
 */
export async function testIPFSConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
  try {
    // IPFS URLはサーバーサイドの環境変数から取得
    const response = await fetch('/api/ipfs/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    // レスポンスの解析
    let result
    try {
      result = await response.json()
    } catch (parseError) {
      // JSON解析に失敗した場合
      const text = await response.text()
      return {
        connected: false,
        error: `レスポンスの解析に失敗しました: ${text}`,
      }
    }

    // サーバーサイドから返された結果をそのまま返す
    // サーバーサイドのtestKuboRPCConnectionが既に適切なエラーメッセージを設定している
    return result
  } catch (error: any) {
    // fetch自体が失敗した場合（ネットワークエラーなど）
    console.error('IPFS接続テストAPI呼び出しエラー:', error)
    return {
      connected: false,
      error: error.message || 'API呼び出しに失敗しました',
    }
  }
}

/**
 * 注意: ピン機能はアップロード時に自動的に実行されます
 * 個別のピン追加が必要な場合は、サーバーサイドAPIを拡張してください
 */
export async function pinFile(
  cid: string,
  ipfsUrl: string = process.env.NEXT_PUBLIC_IPFS_URL || 'http://localhost:5001'
): Promise<boolean> {
  // アップロード時に自動的にピンされるため、通常はこの関数を使用する必要はありません
  console.warn('pinFile関数は現在サポートされていません。アップロード時に自動的にピンされます。')
  return false
}

