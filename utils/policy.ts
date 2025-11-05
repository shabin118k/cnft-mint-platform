// CardanoポリシーID生成関連のユーティリティ関数
// @emurgo/cardano-serialization-libを使用
// 注意: このモジュールはクライアントサイド（ブラウザ）でのみ使用可能です

import * as CSL from '@emurgo/cardano-serialization-lib-browser'

/**
 * ポリシーキーペア（秘密鍵と公開鍵）
 */
export interface PolicyKeyPair {
  privateKey: string // hex形式の秘密鍵
  publicKey: string // hex形式の公開鍵
  policyKeyHash: string // 公開鍵のハッシュ（ポリシーID生成に使用）
}

/**
 * ポリシースクリプト（タイムロック付き）
 */
export interface PolicyScript {
  nativeScript: any // CSL.NativeScript
  policyId: string // ポリシーID（スクリプトハッシュ）
}

/**
 * ランダムなバイトを生成
 */
function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes)
  } else {
    // Node.js環境
    const crypto = require('crypto')
    const randomBytes = crypto.randomBytes(length)
    return new Uint8Array(randomBytes)
  }
  return bytes
}

/**
 * バイト配列をhex文字列に変換
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * hex文字列をバイト配列に変換
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

/**
 * ポリシーキーペアを生成（Ed25519）
 * 注意: この関数はクライアントサイド（ブラウザ）でのみ使用可能です
 */
export function generatePolicyKeyPair(): PolicyKeyPair {
  if (typeof window === 'undefined') {
    throw new Error('generatePolicyKeyPairはブラウザ環境でのみ使用可能です')
  }
  
  // CSLを使用してEd25519秘密鍵を生成
  const privateKey = CSL.PrivateKey.generate_ed25519()
  const publicKey = privateKey.to_public()
  
  // 公開鍵のハッシュ（28バイト = 56文字のhex）
  const publicKeyHash = publicKey.hash()
  
  return {
    privateKey: bytesToHex(privateKey.as_bytes()),
    publicKey: bytesToHex(publicKey.as_bytes()),
    policyKeyHash: bytesToHex(publicKeyHash.to_bytes()),
  }
}

/**
 * ポリシースクリプトを作成（タイムロック付き）
 * 注意: この関数はクライアントサイド（ブラウザ）でのみ使用可能です
 */
export function createPolicyScript(
  keyHashHex: string,
  expiresAfterSlot?: number
): PolicyScript {
  if (typeof window === 'undefined') {
    throw new Error('createPolicyScriptはブラウザ環境でのみ使用可能です')
  }
  
  // キーハッシュを復元
  const keyHashBytes = hexToBytes(keyHashHex)
  const keyHash = CSL.Ed25519KeyHash.from_bytes(keyHashBytes)
  
  // 署名要求スクリプトを作成
  const scriptPubkey = CSL.ScriptPubkey.new(keyHash)
  
  // 有効期限が指定されている場合、タイムロックを追加
  if (expiresAfterSlot !== undefined && expiresAfterSlot > 0) {
    // TimelockExpiryを使用（このスロット以前にのみ有効 = 有効期限）
    const timelockExpiry = CSL.TimelockExpiry.new(expiresAfterSlot)
    const timeExpiryScript = CSL.NativeScript.new_timelock_expiry(timelockExpiry)
    
    // ScriptAllで署名要求とタイムロックを組み合わせる（両方の条件を満たす必要がある）
    const nativeScripts = CSL.NativeScripts.new()
    nativeScripts.add(CSL.NativeScript.new_script_pubkey(scriptPubkey))
    nativeScripts.add(timeExpiryScript)
    const scriptAll = CSL.ScriptAll.new(nativeScripts)
    
    const nativeScript = CSL.NativeScript.new_script_all(scriptAll)
    
    // ポリシーIDを計算（スクリプトハッシュ）
    const scriptHash = nativeScript.hash()
    const policyId = bytesToHex(scriptHash.to_bytes())
    
    return {
      nativeScript,
      policyId,
    }
  }
  
  // 有効期限が指定されていない場合は署名要求のみ
  const nativeScript = CSL.NativeScript.new_script_pubkey(scriptPubkey)
  
  // ポリシーIDを計算（スクリプトハッシュ）
  const scriptHash = nativeScript.hash()
  const policyId = bytesToHex(scriptHash.to_bytes())
  
  return {
    nativeScript,
    policyId,
  }
}

/**
 * ポリシーIDを生成
 * 注意: この関数はクライアントサイド（ブラウザ）でのみ使用可能です
 */
export function generatePolicyId(
  expiresAfterSlot?: number
): { policyId: string; keyPair: PolicyKeyPair; policyScript: PolicyScript } {
  if (typeof window === 'undefined') {
    throw new Error('generatePolicyIdはブラウザ環境でのみ使用可能です')
  }
  
  // 1. ポリシーキーペアを生成
  const keyPair = generatePolicyKeyPair()
  
  // 2. ポリシースクリプトを作成
  const policyScript = createPolicyScript(keyPair.policyKeyHash, expiresAfterSlot)
  
  return {
    policyId: policyScript.policyId,
    keyPair,
    policyScript,
  }
}

/**
 * Koios APIから現在のスロット番号を取得
 * 
 * @param networkId - ネットワークID (0: Preprod/Testnet, 1: Mainnet)
 * @returns 現在のスロット番号
 */
export async function getCurrentSlotFromKoios(networkId: number = 0): Promise<number> {
  try {
    console.log('Fetching current slot via server API:', { networkId })
    
    const response = await fetch(`/api/koios/current-slot?networkId=${networkId}`)
    if (!response.ok) {
      throw new Error(`Server API error: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data && data.slot !== undefined) {
      console.log('Koios slot fetched successfully:', { slot: data.slot, networkId })
      return data.slot
    }
    
    throw new Error('Invalid response from server API')
  } catch (error) {
    console.warn('Failed to fetch current slot via server API, using fallback:', error)
    // フォールバック: 簡易実装を使用
    return getCurrentSlotFallback(networkId)
  }
}

/**
 * 現在のスロット番号を取得（簡易実装、フォールバック用）
 * 実際の実装では、Cardanoネットワークから現在のスロットを取得する必要があります
 * 
 * 注意: Cardano mainnet/testnetでは、スロット計算方法が異なります：
 * - Mainnet: epoch 0開始時刻から経過したスロット数
 * - Testnet: epoch 0開始時刻から経過したスロット数
 * 
 * 実際のスロット取得には、CardanoノードまたはブロックエクスプローラーAPIを使用してください
 * 
 * @param networkId - ネットワークID (0: Preprod/Testnet, 1: Mainnet)
 */
function getCurrentSlotFallback(networkId: number = 0): number {
  // 注意: これは簡易実装です
  // 実際の実装では、Cardanoネットワーク（testnet/mainnet）から現在のスロットを取得
  // または、cardano-serialization-libを使用してスロットを計算
  
  // 簡易実装: 現在時刻からスロットを推定
  // Mainnet epoch 0開始時刻: 2020-07-29 21:44:51 UTC (1596059091000 ms)
  // Testnet epoch 0開始時刻: 2020-07-20 20:20:16 UTC (1595276416000 ms)
  
  const isMainnet = networkId === 1
  
  const epoch0StartMs = isMainnet 
    ? 1596059091000  // Mainnet epoch 0開始
    : 1595276416000  // Testnet epoch 0開始
  
  const slotsPerSecond = 1 // 両ネットワークとも 1スロット/秒
  const now = Date.now()
  
  // スロット計算: (現在時刻 - epoch 0開始) * slotsPerSecond / 1000
  const elapsedSeconds = (now - epoch0StartMs) / 1000
  const currentSlot = Math.floor(elapsedSeconds * slotsPerSecond)
  
  console.warn('Using fallback slot calculation:', { networkId, currentSlot, epoch0StartMs })
  return currentSlot
}

/**
 * 現在のスロット番号を取得（自動選択: Koios API → フォールバック）
 * 
 * @param networkId - ネットワークID (0: Preprod/Testnet, 1: Mainnet)
 */
export async function getCurrentSlot(networkId: number = 0): Promise<number> {
  try {
    return await getCurrentSlotFromKoios(networkId)
  } catch (error) {
    console.warn('Failed to get current slot, using fallback:', error)
    return getCurrentSlotFallback(networkId)
  }
}

/**
 * スロットから有効期限を計算（例: 1時間後）
 * Cardano Testnet: 1スロット = 1秒
 * Cardano Mainnet: 1スロット = 1秒（シェリーエラ後の設定）
 * 
 * @param hours - 有効期限までの時間（時間）
 * @param networkId - ネットワークID (0: Preprod/Testnet, 1: Mainnet)
 */
export async function calculateExpirySlot(hours: number = 1, networkId: number = 0): Promise<number> {
  const currentSlot = await getCurrentSlot(networkId)
  const slotsPerHour = 3600 // 1時間 = 3600スロット（1スロット/秒）
  return currentSlot + (hours * slotsPerHour)
}

/**
 * ポリシースクリプトをCBOR形式にエンコード
 */
export function encodePolicyScript(policyScript: PolicyScript): string {
  return bytesToHex(policyScript.nativeScript.to_bytes())
}

/**
 * hex形式のポリシーIDを検証（長さチェック）
 */
export function validatePolicyId(policyId: string): boolean {
  // ポリシーIDは56文字（28バイト）のhex文字列である必要がある
  return /^[0-9a-fA-F]{56}$/.test(policyId)
}

/**
 * 既存の秘密鍵からポリシーキーペアを復元
 * 注意: この関数はクライアントサイド（ブラウザ）でのみ使用可能です
 */
export function restorePolicyKeyPair(privateKeyHex: string): PolicyKeyPair {
  if (typeof window === 'undefined') {
    throw new Error('restorePolicyKeyPairはブラウザ環境でのみ使用可能です')
  }
  
  const privateKeyBytes = hexToBytes(privateKeyHex)
  
  // CSLを使用して秘密鍵を復元
  // 注意: 32バイトの生の秘密鍵または64バイトの拡張秘密鍵のどちらかを使用可能
  let privateKey: any
  try {
    // まず32バイトの生の秘密鍵として試行
    if (privateKeyBytes.length === 32) {
      privateKey = CSL.PrivateKey.from_extended_bytes(privateKeyBytes)
    } else if (privateKeyBytes.length === 64) {
      privateKey = CSL.PrivateKey.from_extended_bytes(privateKeyBytes)
    } else {
      throw new Error('秘密鍵は32バイトまたは64バイトである必要があります')
    }
  } catch (error: any) {
    throw new Error(`秘密鍵の復元に失敗しました: ${error.message || error}`)
  }
  
  const publicKey = privateKey.to_public()
  const publicKeyHash = publicKey.hash()
  
  return {
    privateKey: privateKeyHex,
    publicKey: bytesToHex(publicKey.as_bytes()),
    policyKeyHash: bytesToHex(publicKeyHash.to_bytes()),
  }
}
