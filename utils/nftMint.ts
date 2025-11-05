// Cardano NFTミント機能の実装
// 注意: 実際のプロダクションでは、@meshsdk/coreまたはcardano-serialization-libを使用してください

import * as CSL from '@emurgo/cardano-serialization-lib-browser'

import { uploadToLocalIPFS, uploadMetadataToIPFS } from './ipfs'
import { generatePolicyId, calculateExpirySlot, encodePolicyScript } from './policy'
import { buildTransaction, signTransaction, submitTransaction } from './transaction'
import { mintCIP68, DEFAULT_CIP68_CONFIG } from './mintCIP68'
import { NFTMetadata, createMetadata, stringToHex as cardanoStringToHex } from './cardano'

export interface MintNFTParams {
  wallet: any
  nftName: string
  description: string
  imageFile: File
  policyId?: string // 既存のポリシーIDを使用する場合
  generateNewPolicy?: boolean // 新しいポリシーIDを生成するかどうか（デフォルト: false）
  policyExpiryHours?: number // ポリシーの有効期限（時間、デフォルト: 1時間）
  policyScriptHex?: string // 既存ポリシー利用時のネイティブスクリプト（hex）
  policyPrivateKeyHex?: string // 既存ポリシー利用時の秘密鍵（hex）
  onProgress?: (progress: { stage: string; message: string }) => void // 進捗コールバック
  extraMetadata?: Record<string | number, any> // 任意ラベルのオンチェーンメタデータ
  customFields?: Record<string, any> // CIP-25内のアセットフィールドへ追加・上書き
  cip68?: {
    enabled: boolean
    baseName?: string // .ref / .nft の共通ベース名（未指定時はnftName）
    datumOverride?: Record<string, any> // インラインDatumを手動で上書きする場合
  }
}

export interface MintNFTResult {
  transactionHash: string
  imageCid: string
  metadataCid: string
  policyId: string
  assetName: string
  keyPair?: {
    privateKey: string
    publicKey: string
    policyKeyHash: string
  }
  policyScriptHex?: string
}

function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '').trim()
  if (cleaned.length % 2 !== 0) {
    throw new Error('hex文字列の長さは偶数である必要があります')
  }
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function stringToHex(str: string): string {
  if (typeof cardanoStringToHex === 'function') {
    return cardanoStringToHex(str)
  }
  let hex = ''
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    const hexValue = charCode.toString(16)
    hex += hexValue.padStart(2, '0')
  }
  return hex
}

/**
 * NFTをミントする（簡易実装）
 * 
 * 注意: この実装は基本的な構造を示しています。
 * 実際のプロダクションでは、以下を実装する必要があります：
 * 1. ポリシーIDの生成（初回ミント時）
 * 2. メタデータのIPFSへのアップロード
 * 3. トランザクションの構築（UTXOの選択、出力の作成）
 * 4. トランザクションの署名と送信
 * 5. エラーハンドリングとリトライロジック
 */
export async function mintNFT(params: MintNFTParams): Promise<MintNFTResult> {
  const { wallet, nftName, description, imageFile, generateNewPolicy, policyExpiryHours, onProgress } = params

  try {
    // 0. ネットワークIDを取得
    const networkId = await wallet.getNetworkId()
    console.log('Network ID:', networkId)
    
    // 0. ポリシーIDを生成または取得
    let policyId: string
    let keyPair: { privateKey: string; publicKey: string; policyKeyHash: string } | undefined
    let policyScript: any | undefined
    let policyScriptHex: string | undefined

    if (generateNewPolicy) {
      // 新しいポリシーIDを生成
      onProgress?.({ stage: 'policy', message: 'ポリシーIDを生成中...' })
      const expirySlot = policyExpiryHours 
        ? await calculateExpirySlot(policyExpiryHours, networkId)
        : await calculateExpirySlot(1, networkId) // デフォルト: 1時間後
      
      console.log('Policy script expiry slot:', {
        expirySlot,
        policyExpiryHours: policyExpiryHours || 1,
        networkId,
        currentTime: Date.now(),
      })
      
      const policyResult = generatePolicyId(expirySlot)
      policyId = policyResult.policyId
      keyPair = policyResult.keyPair
      policyScript = policyResult.policyScript.nativeScript
      policyScriptHex = encodePolicyScript(policyResult.policyScript)
      
      onProgress?.({ stage: 'policy', message: `ポリシーID生成完了: ${policyId}` })
    } else if (params.policyId) {
      // 既存のポリシーIDを使用
      policyId = params.policyId
      onProgress?.({ stage: 'policy', message: '既存のポリシーIDを使用中...' })

      if (!params.policyScriptHex || !params.policyPrivateKeyHex) {
        throw new Error('既存のポリシーを使用してミントする場合は、ポリシースクリプトと秘密鍵が必要です')
      }

      try {
        const scriptBytes = hexToBytes(params.policyScriptHex)
        policyScript = CSL.NativeScript.from_bytes(scriptBytes)
        policyScriptHex = params.policyScriptHex
      } catch (scriptError: any) {
        throw new Error(`ポリシースクリプトの復元に失敗しました: ${scriptError.message || scriptError}`)
      }

      try {
        const privateKeyBytes = hexToBytes(params.policyPrivateKeyHex)
        const privateKey = privateKeyBytes.length === 32
          ? CSL.PrivateKey.from_normal_bytes(privateKeyBytes)
          : CSL.PrivateKey.from_extended_bytes(privateKeyBytes)

        const publicKey = privateKey.to_public()
        keyPair = {
          privateKey: params.policyPrivateKeyHex,
          publicKey: bytesToHex(publicKey.as_bytes()),
          policyKeyHash: bytesToHex(publicKey.hash().to_bytes()),
        }
      } catch (keyError: any) {
        throw new Error(`ポリシー秘密鍵の復元に失敗しました: ${keyError.message || keyError}`)
      }
    } else {
      throw new Error('ポリシー情報が不足しています。新しいポリシーを生成するか、既存ポリシー情報を提供してください。')
    }
    
    // 1. 画像をIPFSにアップロード（IPFS URLはサーバーサイドの環境変数から取得）
    onProgress?.({ stage: 'upload', message: '画像をIPFSにアップロード中...' })
    const imageCid = await uploadToLocalIPFS(imageFile)
    const imageIpfsUrl = `ipfs://${imageCid}`
    
    onProgress?.({ stage: 'metadata', message: 'メタデータを作成中...' })
    
    // 2. アセット名を生成（hex文字列、最大32バイト = 64文字）
    // 注意: アセット名は32バイト以下である必要があります
    let assetName: string
    const nftNameHex = stringToHex(nftName)
    if (nftNameHex.length <= 64) {
      // 64文字（32バイト）以下の場合、そのまま使用
      assetName = nftNameHex
    } else {
      // 64文字を超える場合、最初の64文字を使用
      assetName = nftNameHex.substring(0, 64)
      console.warn(`アセット名が長すぎるため、最初の64文字を使用します: ${assetName}`)
    }
    
    // アセット名が偶数長でない場合は調整（hex文字列は偶数長である必要がある）
    if (assetName.length % 2 !== 0) {
      assetName = '0' + assetName
    }
    
    console.log('アセット名生成:', {
      nftName,
      assetName,
      assetNameLength: assetName.length,
      assetNameBytes: assetName.length / 2,
    })
    
    const baseMetadata: NFTMetadata = {
      name: nftName,
      description: description,
      image: imageIpfsUrl,
      mediaType: imageFile.type,
    }

    const metadata: NFTMetadata = {
      ...baseMetadata,
      ...(params.customFields || {}),
    }
    
    // 4. メタデータをIPFSにアップロード（IPFS URLはサーバーサイドの環境変数から取得）
    onProgress?.({ stage: 'uploadMetadata', message: 'メタデータをIPFSにアップロード中...' })
    const metadataCid = await uploadMetadataToIPFS({
      name: nftName,
      description: description,
      image: imageIpfsUrl,
      mediaType: imageFile.type,
    })

    // 5. CIP-25標準に準拠したメタデータを作成
    const cip25Metadata = createMetadata(policyId, assetName, metadata)

    // CIP-68 ミントモード（優先）
    if (params.cip68?.enabled) {
      const baseName = params.cip68.baseName?.trim() || nftName.trim()
      const datum = params.cip68.datumOverride || metadata
      onProgress?.({ stage: 'cip68', message: 'CIP-68ミントを開始します...' })
      const result = await mintCIP68(DEFAULT_CIP68_CONFIG, {
        wallet,
        baseName,
        datum,
        onProgress,
        networkId,
      })

      return {
        transactionHash: result.transactionHash,
        imageCid,
        metadataCid,
        policyId: result.policyId,
        assetName: result.userAssetName,
        keyPair,
        policyScriptHex,
      }
    }

    // 6. トランザクションの構築と送信
    onProgress?.({ stage: 'transaction', message: 'トランザクションを構築中...' })
    
    // ウォレットからアドレスを取得
    const addresses = await wallet.getUsedAddresses()
    const recipientAddress = addresses[0] || await wallet.getChangeAddress()
    
    if (!recipientAddress) {
      throw new Error('アドレスを取得できませんでした')
    }
    
    // アセット名をhex形式に変換（既にhex形式の場合）
    const assetNameHex = assetName
    
    // トランザクション出力を作成（NFTをミント）
    const outputs = [
      {
        address: recipientAddress,
        amount: 2000000n, // 最小UTXO（2 ADA）+ NFT保持用
        assets: [
          {
            policyId,
            assetName: assetNameHex,
            quantity: 1n, // NFT数量（通常は1）
          },
        ],
      },
    ]
    
    console.log('Mint NFT debug - preparing transaction', {
      policyId,
      assetNameHex,
      outputs,
      mintAssets: policyScript
        ? [
            {
              policyId,
              assetName: assetNameHex,
              quantity: 1n,
            },
          ]
        : undefined,
    })

    // トランザクションを構築
    const buildResult = await buildTransaction({
      wallet,
      outputs,
      metadata: cip25Metadata,
      extraMetadata: params.extraMetadata,
      changeAddress: recipientAddress,
      policyId: policyScript ? policyId : undefined,
      policyScript: policyScript,
      policyKey: keyPair?.privateKey,
      mintAssets: policyScript
        ? [
            {
              policyId,
              assetName: assetNameHex,
              quantity: 1n,
            },
          ]
        : undefined,
      networkId: networkId,
    })
    
    onProgress?.({ stage: 'signing', message: 'トランザクションに署名中...' })
    
    // トランザクションに署名
    const signedTxHex = await signTransaction(
      wallet,
      buildResult.transaction,
      buildResult.policyWitnessHex
    )
    
    onProgress?.({ stage: 'submitting', message: 'トランザクションを送信中...' })
    
    // トランザクションを送信
    const txHash = await submitTransaction(wallet, signedTxHex)
    
    onProgress?.({ stage: 'complete', message: `トランザクション送信完了: ${txHash}` })

    return {
      transactionHash: txHash,
      imageCid,
      metadataCid,
      policyId,
      assetName,
      keyPair,
      policyScriptHex,
    }

  } catch (error) {
    console.error('NFTミントエラー:', error)
    throw error
  }
}


