// Cardano NFTミント関連のユーティリティ関数

export interface NFTMetadata {
  name: string
  description: string
  image: string
  mediaType: string
  [key: string]: any
}

/**
 * CIP-25標準に準拠したメタデータを作成
 */
export function createMetadata(
  policyId: string,
  assetName: string,
  metadata: NFTMetadata
) {
  const { name, description, image, mediaType, ...rest } = metadata
  return {
    [policyId]: {
      [assetName]: {
        name,
        description,
        image,
        mediaType,
        ...rest,
      },
    },
  }
}

/**
 * ファイルをBase64に変換
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      // data:image/png;base64,のプレフィックスを除去
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = error => reject(error)
  })
}

/**
 * ランダムなアセット名を生成（hex文字列）
 */
export function generateAssetName(length: number = 32): string {
  const chars = '0123456789abcdef'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 文字列をhexエンコード
 */
export function stringToHex(str: string): string {
  let hex = ''
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    const hexValue = charCode.toString(16)
    hex += hexValue.padStart(2, '0')
  }
  return hex
}

/**
 * ウォレットオブジェクトを取得
 * preferredKeyが指定された場合はそのウォレットを優先的に有効化する
 */
export async function getWallet(preferredKey?: string): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('ブラウザ環境で実行してください')
  }

  const cardano = (window as any).cardano
  if (!cardano) {
    throw new Error('Cardanoウォレット拡張機能が見つかりません')
  }

  // 指定されたウォレットキーが存在する場合はそれを使用
  if (preferredKey) {
    const walletProvider = cardano[preferredKey]
    if (!walletProvider) {
      throw new Error(`${preferredKey} ウォレットが見つかりません。インストールされているか確認してください。`)
    }
    return await walletProvider.enable()
  }

  // 利用可能なウォレットを試す（優先順位順）
  if (cardano.nami) {
    return await cardano.nami.enable()
  } else if (cardano.eternl) {
    return await cardano.eternl.enable()
  } else if (cardano.flint) {
    return await cardano.flint.enable()
  } else if (cardano.yoroi) {
    return await cardano.yoroi.enable()
  } else {
    // 他のウォレットを試す
    const walletKeys = Object.keys(cardano)
    if (walletKeys.length > 0) {
      return await cardano[walletKeys[0]].enable()
    }
    throw new Error('利用可能なウォレットが見つかりません')
  }
}

