// サーバーサイドIPFS（Kubo RPC）ユーティリティ関数

export interface KuboRPCUploadOptions {
  pin?: boolean
  wrapWithDirectory?: boolean
}

/**
 * サーバーサイドでKubo RPCを使用してファイルをアップロード
 */
export async function uploadToKuboRPC(
  fileBuffer: Buffer,
  fileName: string,
  ipfsUrl: string = process.env.IPFS_URL || 'http://localhost:5001',
  options: KuboRPCUploadOptions = {}
): Promise<string> {
  try {
    // URLを正規化（localhostと127.0.0.1の統一）
    let normalizedUrl = ipfsUrl.trim()
    if (normalizedUrl.includes('localhost')) {
      normalizedUrl = normalizedUrl.replace('localhost', '127.0.0.1')
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '')
    
    // FormDataを作成（form-dataパッケージを使用）
    const FormData = require('form-data')
    const formData = new FormData()
    
    // ファイルを追加
    formData.append('file', fileBuffer, {
      filename: fileName,
      contentType: 'application/octet-stream',
    })

    // Kubo RPCオプションを追加
    const params = new URLSearchParams()
    
    // ピン設定（デフォルト: true）
    if (options.pin !== false) {
      params.append('pin', 'true')
    } else {
      params.append('pin', 'false')
    }

    // ディレクトリでラップするかどうか
    if (options.wrapWithDirectory) {
      params.append('wrap-with-directory', 'true')
    }

    params.append('only-hash', 'false')
    params.append('chunker', 'size-262144')

    // Kubo RPC APIにアップロード
    const url = `${normalizedUrl}/api/v0/add?${params.toString()}`
    
    // Node.jsのhttp/httpsモジュールを使用してFormDataを送信
    // （form-dataパッケージとNext.jsのfetchの互換性問題を回避）
    const http = require('http')
    const https = require('https')
    const urlObj = new URL(normalizedUrl)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    return new Promise((resolve, reject) => {
      const headers = formData.getHeaders()
      
      const req = client.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: `/api/v0/add?${params.toString()}`,
        method: 'POST',
        headers: headers,
      }, (res: any) => {
        let responseText = ''
        
        res.on('data', (chunk: Buffer) => {
          responseText += chunk.toString()
        })
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            let errorMessage = `IPFSアップロードに失敗しました: ${res.statusCode}`
            
            try {
              const errorJson = JSON.parse(responseText)
              errorMessage = errorJson.Message || errorJson.message || errorMessage
            } catch {
              if (responseText) {
                errorMessage = `${errorMessage} - ${responseText}`
              }
            }
            
            return reject(new Error(errorMessage))
          }
          
          const lines = responseText.trim().split('\n').filter((line: string) => line.trim())
          
          if (lines.length === 0) {
            return reject(new Error('IPFSレスポンスが空です'))
          }
          
          const lastLine = lines[lines.length - 1]
          let result
          
          try {
            result = JSON.parse(lastLine)
          } catch (parseError) {
            return reject(new Error(`IPFSレスポンスの解析に失敗しました: ${lastLine}`))
          }
          
          const cid = result.Hash || result.cid || result.Cid
          
          if (!cid) {
            return reject(new Error('IPFSハッシュ（CID）が取得できませんでした'))
          }
          
          resolve(cid)
        })
      })
      
      req.on('error', (error: any) => {
        reject(error)
      })
      
      // FormDataストリームをパイプ
      formData.pipe(req)
    })
  } catch (error: any) {
    console.error('IPFSアップロードエラー:', error)
    throw error
  }
}

/**
 * サーバーサイドでKubo RPC接続をテスト
 */
export async function testKuboRPCConnection(
  ipfsUrl: string = process.env.IPFS_URL || 'http://localhost:5001'
): Promise<{ connected: boolean; version?: string; error?: string }> {
  // URLを正規化（末尾のスラッシュを削除）
  let normalizedUrl = ipfsUrl.trim().replace(/\/$/, '')
  
  // 複数のURLを試す（WSL2環境などで接続できない場合があるため）
  const urlsToTry = []
  
  if (normalizedUrl.includes('localhost') || normalizedUrl.includes('127.0.0.1')) {
    // localhost/127.0.0.1の場合は複数の変形を試す
    urlsToTry.push(normalizedUrl.replace(/localhost|127\.0\.0\.1/, 'localhost'))
    urlsToTry.push(normalizedUrl.replace(/localhost|127\.0\.0\.1/, '127.0.0.1'))
    urlsToTry.push(normalizedUrl.replace(/localhost|127\.0\.0\.1/, '0.0.0.0'))
  } else {
    urlsToTry.push(normalizedUrl)
  }
  
  let lastError: any = null
  
  // 各URLを試す
  for (const url of urlsToTry) {
    try {
      console.log(`Kubo RPC接続テスト: ${url}/api/v0/version`)
      
      // Next.jsの組み込みfetchを使用（サーバーサイド）
      const response = await fetch(`${url}/api/v0/version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    
      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
        continue // 次のURLを試す
      }

      const result = await response.json()
      
      // 成功したURLを見つけた
      return {
        connected: true,
        version: result.Version || result.version || 'unknown',
      }
    } catch (error: any) {
      // このURLで失敗したが、他のURLを試す
      lastError = error
      continue
    }
  }
  
  // すべてのURLで失敗した場合
  const error = lastError || new Error('すべてのURLで接続に失敗しました')
  
  // より詳細なエラーメッセージを提供
  let errorMessage = '接続エラー'
  
  // Undiciのfetchエラーでは、エラー詳細がerror.causeに含まれる場合がある
  const cause = error.cause || error
  const errorCode = cause.code || error.code
  const errorMessageText = cause.message || error.message
  
  if (errorCode === 'ECONNREFUSED') {
    errorMessage = `Kubo RPCサーバーへの接続が拒否されました。\n\n確認事項:\n1. Kuboが起動しているか確認: ipfs daemon\n2. APIアドレスを確認: ipfs config Addresses.API\n3. WSL2/Docker環境の場合、WindowsホストのIPアドレス（例: http://172.x.x.x:5001）を使用してください\n4. 別のアドレス（localhost/127.0.0.1/0.0.0.0）を試してみてください\n\n試したURL: ${urlsToTry.join(', ')}`
  } else if (error instanceof TypeError && (errorMessageText?.includes('fetch failed') || errorMessageText?.includes('ECONNREFUSED'))) {
    errorMessage = `Kubo RPCサーバーに接続できません。\n\n確認事項:\n1. Kuboが起動しているか確認: ipfs daemon\n2. APIアドレスを確認: ipfs config Addresses.API\n3. WSL2/Docker環境の場合、WindowsホストのIPアドレスを使用してください\n4. 別のアドレスを試してみてください\n\n試したURL: ${urlsToTry.join(', ')}`
  } else if (errorMessageText) {
    errorMessage = `${errorMessageText}\n\n試したURL: ${urlsToTry.join(', ')}`
  }
  
  console.error('Kubo RPC接続テストエラー (すべてのURLで失敗):', error)
  
  return {
    connected: false,
    error: errorMessage,
  }
}

