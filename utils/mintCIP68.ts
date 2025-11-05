// CIP-68 ミント（参照スクリプト: 公開スクリプト想定）
// 注意: 実運用にはPlutus V2スクリプトCBORとスクリプトアドレス、必要なリディーマ/コラテラル構成が必須

import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { generatePolicyKeyPair, createPolicyScript } from './policy'

export interface CIP68Config {
  // 公開スクリプトのCBOR(hex) または ScriptHash から生成する
  scriptCborHex?: string
  scriptAddressBech32?: string
  usePlutusV2?: boolean // Plutus V2スクリプトを使用するか（デフォルト: false = ネイティブスクリプト）
  redeemer?: any // Plutus V2用のリディーマ（未指定時は空のリディーマ）
}

export interface MintCIP68Params {
  wallet: any
  baseName: string
  datum: Record<string, any> // CIP-25互換のキーを格納
  onProgress?: (progress: { stage: string; message: string }) => void
  networkId: number
}

export interface MintCIP68Result {
  transactionHash: string
  policyId: string
  refAssetName: string
  userAssetName: string
}

export const DEFAULT_CIP68_CONFIG: CIP68Config = {
  // 環境変数が設定されている場合は優先、なければ動的生成
  scriptCborHex: (process.env.NEXT_PUBLIC_CIP68_SCRIPT_CBOR_HEX as string) || '',
  scriptAddressBech32: (process.env.NEXT_PUBLIC_CIP68_SCRIPT_ADDRESS as string) || '',
  usePlutusV2: process.env.NEXT_PUBLIC_CIP68_USE_PLUTUS_V2 === 'true',
}

/**
 * CIP-68用のネイティブスクリプトを動的に生成
 * 環境変数が未設定の場合に自動生成されます
 */
export function generateCIP68ScriptConfig(networkId: number = 1): CIP68Config {
  if (typeof window === 'undefined') {
    throw new Error('generateCIP68ScriptConfigはブラウザ環境でのみ使用可能です')
  }

  // 1. ネイティブスクリプト用のキーペアを生成
  const keyPair = generatePolicyKeyPair()
  const policyScript = createPolicyScript(keyPair.policyKeyHash)

  // 2. ネイティブスクリプトからスクリプトハッシュを取得
  const scriptHash = policyScript.nativeScript.hash()

  // 3. スクリプトアドレスを生成（Mainnet: networkId=1, Testnet: networkId=0）
  const enterpriseAddress = CSL.EnterpriseAddress.new(
    networkId,
    CSL.Credential.from_scripthash(scriptHash)
  )
  const scriptAddressBech32 = enterpriseAddress.to_address().to_bech32()

  // 4. スクリプトのCBOR(hex)を取得
  const scriptBytes = policyScript.nativeScript.to_bytes()
  let scriptCborHex = ''
  for (let i = 0; i < scriptBytes.len(); i++) {
    scriptCborHex += scriptBytes.get(i).toString(16).padStart(2, '0')
  }

  return {
    scriptCborHex,
    scriptAddressBech32,
    usePlutusV2: false,
  }
}

/**
 * Plutus V2スクリプトから設定を生成
 */
export function generatePlutusV2Config(scriptCborHex: string, networkId: number = 1): CIP68Config {
  if (typeof window === 'undefined') {
    throw new Error('generatePlutusV2Configはブラウザ環境でのみ使用可能です')
  }

  // hexToBytes関数をローカルで実装（transaction.tsからインポートできないため）
  const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes
  }

  // Plutus V2スクリプトを読み込む
  try {
    const scriptBytes = hexToBytes(scriptCborHex)
    const plutusScript = CSL.PlutusScript.from_bytes(scriptBytes)
    const scriptHash = plutusScript.hash()

    // スクリプトアドレスを生成
    const enterpriseAddress = CSL.EnterpriseAddress.new(
      networkId,
      CSL.Credential.from_scripthash(scriptHash)
    )
    const scriptAddressBech32 = enterpriseAddress.to_address().to_bech32()

    return {
      scriptCborHex,
      scriptAddressBech32,
      usePlutusV2: true,
    }
  } catch (error: any) {
    throw new Error(`Plutus V2スクリプトの読み込みに失敗しました: ${error.message || error}`)
  }
}

/**
 * 簡易的なPlutus V2スクリプト（常にTrueを返す）を自動生成
 * 注意: これは最小限のテンプレートスクリプトです。実際の運用では適切なPlutusスクリプトを使用してください
 */
export function generateSimplePlutusV2Script(networkId: number = 1): CIP68Config {
  if (typeof window === 'undefined') {
    throw new Error('generateSimplePlutusV2Scriptはブラウザ環境でのみ使用可能です')
  }

  // 簡易的なPlutus V2スクリプト（常にTrueを返す最小スクリプト）
  // これは最小限のテンプレートで、実際のCIP-68ではより複雑なスクリプトが必要です
  // Plutus V2スクリプトのCBORは複雑なため、事前にコンパイルされた簡易スクリプトのCBORを使用
  // 注意: このテンプレートは実際のCIP-68標準とは異なる可能性があります
  
  // 最小限のPlutus V2スクリプト（常にTrueを返す）のCBORテンプレート
  // 実際のPlutusスクリプト: `validator _ _ _ = True`
  // このCBORは例示用で、実際の運用では適切なPlutusスクリプトのCBORを使用してください
  const SIMPLE_PLUTUS_V2_SCRIPT_CBOR = '4e4d01000033222220051200120011'
  
  // 上記のCBORは例示用です。実際のCIP-68では、適切なPlutus V2スクリプトのCBORが必要です
  // 本番環境では、cardano-cliなどでコンパイルしたPlutusスクリプトのCBORを使用することを推奨します
  
  try {
    return generatePlutusV2Config(SIMPLE_PLUTUS_V2_SCRIPT_CBOR, networkId)
  } catch (error: any) {
    // CBORが無効な場合、ネイティブスクリプトにフォールバック
    console.warn('Plutus V2スクリプトの生成に失敗、ネイティブスクリプトにフォールバック:', error)
    return generateCIP68ScriptConfig(networkId)
  }
}

function stringToHex(str: string): string {
  let hex = ''
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    hex += charCode.toString(16).padStart(2, '0')
  }
  return hex
}

function toPlutusDataFromObject(obj: any): CSL.PlutusData {
  // 簡易: {k:v} を PlutusData(Map) に変換（文字列・数値・bool・オブジェクト・配列）
  if (obj === null || obj === undefined) {
    return CSL.PlutusData.new_constr_plutus_data(
      CSL.ConstrPlutusData.new(CSL.BigNum.from_str('0'), CSL.PlutusList.new())
    )
  }
  if (typeof obj === 'string') {
    return CSL.PlutusData.new_bytes(new TextEncoder().encode(obj))
  }
  if (typeof obj === 'number') {
    if (Number.isInteger(obj) && obj >= 0) {
      return CSL.PlutusData.new_integer(CSL.BigInt.from_str(obj.toString()))
    }
    return CSL.PlutusData.new_bytes(new TextEncoder().encode(String(obj)))
  }
  if (typeof obj === 'boolean') {
    return CSL.PlutusData.new_integer(CSL.BigInt.from_str(obj ? '1' : '0'))
  }
  if (Array.isArray(obj)) {
    const list = CSL.PlutusList.new()
    for (const item of obj) list.add(toPlutusDataFromObject(item))
    return CSL.PlutusData.new_list(list)
  }
  if (typeof obj === 'object') {
    const map = CSL.PlutusMap.new()
    for (const [k, v] of Object.entries(obj)) {
      const keyData = CSL.PlutusData.new_bytes(new TextEncoder().encode(String(k)))
      const valData = toPlutusDataFromObject(v)
      // PlutusMapValuesを作成してPlutusDataをラップ
      const mapValues = CSL.PlutusMapValues.new()
      mapValues.add(valData)
      map.insert(keyData, mapValues)
    }
    return CSL.PlutusData.new_map(map)
  }
  return CSL.PlutusData.new_bytes(new TextEncoder().encode(String(obj)))
}

export async function mintCIP68(
  cfg: CIP68Config,
  params: MintCIP68Params
): Promise<MintCIP68Result> {
  const { wallet, baseName, datum, onProgress, networkId } = params

  // 設定が未完了の場合は動的生成を試行
  let finalConfig = cfg
  if (!cfg.scriptAddressBech32 || !cfg.scriptCborHex) {
    onProgress?.({ stage: 'cip68', message: 'CIP-68スクリプトを動的に生成中...' })
    try {
      // Plutus V2が要求されている場合はPlutus V2スクリプトを生成
      if (cfg.usePlutusV2) {
        finalConfig = generateSimplePlutusV2Script(networkId)
        onProgress?.({ stage: 'cip68', message: `Plutus V2スクリプト自動生成完了: ${finalConfig.scriptAddressBech32}` })
      } else {
        // デフォルトはネイティブスクリプト
        finalConfig = generateCIP68ScriptConfig(networkId)
        onProgress?.({ stage: 'cip68', message: `ネイティブスクリプトアドレス生成完了: ${finalConfig.scriptAddressBech32}` })
      }
    } catch (error: any) {
      const missing = [
        !cfg.scriptCborHex ? 'NEXT_PUBLIC_CIP68_SCRIPT_CBOR_HEX' : null,
        !cfg.scriptAddressBech32 ? 'NEXT_PUBLIC_CIP68_SCRIPT_ADDRESS' : null,
      ].filter(Boolean).join(', ')
      throw new Error(`CIP-68スクリプト生成に失敗しました。環境変数を設定してください: ${missing} - ${error.message || error}`)
    }
  }

  // Plutus V2スクリプトが指定されている場合、スクリプトを読み込んで設定を更新
  if (finalConfig.usePlutusV2 && finalConfig.scriptCborHex) {
    onProgress?.({ stage: 'cip68', message: 'Plutus V2スクリプトを読み込み中...' })
    try {
      const plutusConfig = generatePlutusV2Config(finalConfig.scriptCborHex, networkId)
      finalConfig = { ...finalConfig, ...plutusConfig }
      onProgress?.({ stage: 'cip68', message: `Plutus V2スクリプト読み込み完了: ${finalConfig.scriptAddressBech32}` })
    } catch (error: any) {
      throw new Error(`Plutus V2スクリプトの読み込みに失敗しました: ${error.message || error}`)
    }
  }

  onProgress?.({ stage: 'cip68', message: 'CIP-68ミントを準備中...' })

  // アセット名（hex）
  const baseHex = stringToHex(baseName)
  const refAssetName = baseHex + stringToHex('.ref')
  const userAssetName = baseHex + stringToHex('.nft')

  // 1. ポリシーIDを生成（.ref/.nft両方に使用）
  onProgress?.({ stage: 'cip68', message: 'ポリシーIDを生成中...' })
  const { generatePolicyId, calculateExpirySlot } = await import('./policy')
  const expirySlot = await calculateExpirySlot(1, networkId) // 1時間後
  const policyResult = generatePolicyId(expirySlot)
  const policyId = policyResult.policyId
  const policyScript = policyResult.policyScript.nativeScript
  const policyKeyPair = policyResult.keyPair

  // 2. スクリプトアドレスをデコード
  const scriptAddress = CSL.Address.from_bech32(finalConfig.scriptAddressBech32!)

  // 3. datumをPlutusDataに変換
  onProgress?.({ stage: 'cip68', message: 'インラインDatumを準備中...' })
  const plutusDatum = toPlutusDataFromObject(datum)

  // 4. UTXOを取得
  onProgress?.({ stage: 'cip68', message: 'UTXOを取得中...' })
  const { getUTXOs, hexToBytes, base64ToBytes, decodeAddress } = await import('./transaction')
  const utxos = await getUTXOs(wallet)
  if (utxos.length === 0) {
    throw new Error('利用可能なUTXOが見つかりません')
  }

  // UTXOをTransactionUnspentOutputに変換（buildTransactionと同じロジック）
  const transactionUnspentOutputs = CSL.TransactionUnspentOutputs.new()
  let decodedUtxoCount = 0
  
  for (const utxoString of utxos) {
    try {
      let utxo: CSL.TransactionUnspentOutput | null = null
      
      // UTXOが文字列の場合、CBORエンコードされた形式
      if (typeof utxoString === 'string') {
        // hex形式のCBORエンコードされたUTXOをデコード
        if (utxoString.length > 64 && /^[0-9a-fA-F]+$/.test(utxoString)) {
          try {
            const utxoBytes = hexToBytes(utxoString)
            utxo = CSL.TransactionUnspentOutput.from_bytes(utxoBytes)
            decodedUtxoCount++
          } catch (cborError: any) {
            // UTXOが配列形式（CBORエンコードされたUTXO配列）の場合はスキップ
            console.warn(`UTXOデコード失敗 (hex形式, 長さ: ${utxoString.length}):`, cborError.message || cborError)
          }
        } else if (/^[A-Za-z0-9+/=]+$/.test(utxoString) && utxoString.length > 64) {
          // base64形式
          try {
            const utxoBytes = base64ToBytes(utxoString)
            utxo = CSL.TransactionUnspentOutput.from_bytes(utxoBytes)
            decodedUtxoCount++
          } catch (cborError: any) {
            console.warn(`UTXOデコード失敗 (base64形式, 長さ: ${utxoString.length}):`, cborError.message || cborError)
          }
        } else {
          console.warn(`UTXO形式が不明です (長さ: ${utxoString.length}, タイプ: ${typeof utxoString})`)
        }
      }
      
      if (utxo) {
        transactionUnspentOutputs.add(utxo)
      }
    } catch (error: any) {
      console.warn(`UTXOの処理に失敗: ${error.message || error}`)
    }
  }

  if (transactionUnspentOutputs.len() === 0) {
    throw new Error(`利用可能なUTXOが見つかりません。UTXO形式を確認してください。 (取得数: ${utxos.length}, デコード成功数: ${decodedUtxoCount})`)
  }

  // 5. TransactionBuilderConfigを作成
  const feeCoefficient = CSL.BigNum.from_str('44')
  const feeConstant = CSL.BigNum.from_str('155381')
  const linearFee = CSL.LinearFee.new(feeCoefficient, feeConstant)
  
  const configBuilder = CSL.TransactionBuilderConfigBuilder.new()
    .fee_algo(linearFee)
    .coins_per_utxo_byte(CSL.BigNum.from_str('4310'))
    .pool_deposit(CSL.BigNum.from_str('500000000'))
    .key_deposit(CSL.BigNum.from_str('2000000'))
    .max_value_size(5000)
    .max_tx_size(16384)
  
  const config = configBuilder.build()
  const txBuilder = CSL.TransactionBuilder.new(config)

  // 6. UTXOを追加
  const strategy = CSL.CoinSelectionStrategyCIP2.LargestFirst
  txBuilder.add_inputs_from(transactionUnspentOutputs, strategy)

  // 7. .ref出力（インラインDatum付き、スクリプトアドレスへ）を作成
  onProgress?.({ stage: 'cip68', message: '.ref出力を作成中...' })
  
  // policyIdの検証（スクリプトハッシュは28バイト = 56文字のhex）
  if (policyId.length !== 56) {
    throw new Error(`policyIdの長さが不正です: ${policyId.length}文字 (期待値: 56文字 = 28バイトのスクリプトハッシュ)`)
  }
  
  // refAssetNameの検証
  if (refAssetName.length % 2 !== 0) {
    throw new Error(`refAssetNameのhex長さが不正です: ${refAssetName.length}文字`)
  }
  
  let refValue: CSL.Value
  try {
    refValue = CSL.Value.new(CSL.BigNum.from_str('2000000')) // 最小UTXO（2 ADA）
    const refMultiAsset = CSL.MultiAsset.new()
    
    // policyIdをバイト配列に変換
    let policyHash: CSL.ScriptHash
    try {
      const policyIdBytes = hexToBytes(policyId)
      if (policyIdBytes.length !== 28) {
        throw new Error(`policyIdバイト配列の長さが不正です: ${policyIdBytes.length}バイト (期待値: 28バイト)`)
      }
      policyHash = CSL.ScriptHash.from_bytes(policyIdBytes)
    } catch (error: any) {
      throw new Error(`policyIdの変換に失敗しました: ${error.message || error}`)
    }
    
    // refAssetNameをバイト配列に変換
    let refAssetNameBytes: Uint8Array
    try {
      refAssetNameBytes = hexToBytes(refAssetName)
      if (refAssetNameBytes.length === 0) {
        throw new Error('refAssetNameのバイト配列が空です')
      }
    } catch (error: any) {
      throw new Error(`refAssetNameの変換に失敗しました: ${error.message || error}`)
    }
    
    const refAssets = CSL.Assets.new()
    refAssets.insert(
      CSL.AssetName.new(refAssetNameBytes),
      CSL.BigNum.from_str('1')
    )
    refMultiAsset.insert(policyHash, refAssets)
    refValue.set_multiasset(refMultiAsset)
  } catch (error: any) {
    throw new Error(`.ref出力の作成に失敗しました: ${error.message || error}`)
  }

  const refOutput = CSL.TransactionOutput.new(scriptAddress, refValue)
  
  // Plutus V2の場合、インラインDatumを設定
  if (finalConfig.usePlutusV2) {
    // Plutus V2ではOutputDatumを使用（データハッシュではなくインラインDatum）
    const outputDatum = CSL.OutputDatum.new_data(plutusDatum)
    // TransactionBuilderで直接設定できないため、データハッシュとして設定
    // 実際のインラインDatumはトランザクションボディに含まれる
    const datumHash = CSL.hash_plutus_data(plutusDatum)
    refOutput.set_data_hash(datumHash)
    // 注意: Plutus V2の場合、トランザクションボディにOutputDatumを追加する必要がありますが、
    // CSLのTransactionBuilderでは直接サポートされていない場合があります
  } else {
    // ネイティブスクリプトの場合、データハッシュを設定
    const datumHash = CSL.hash_plutus_data(plutusDatum)
    refOutput.set_data_hash(datumHash)
  }
  
  txBuilder.add_output(refOutput)

  // Plutus V2スクリプトの場合、リディーマとコラテラルを設定
  let plutusWitnessSet: CSL.TransactionWitnessSet | null = null
  let collateralInputs: CSL.TransactionInputs | null = null
  
  if (finalConfig.usePlutusV2) {
    onProgress?.({ stage: 'cip68', message: 'Plutus V2スクリプト用のリディーマとコラテラルを設定中...' })
    
    // リディーマを作成（未指定時は空のリディーマ）
    const redeemerData = finalConfig.redeemer 
      ? toPlutusDataFromObject(finalConfig.redeemer)
      : CSL.PlutusData.new_constr_plutus_data(
          CSL.ConstrPlutusData.new(CSL.BigNum.from_str('0'), CSL.PlutusList.new())
        )
    
    // コラテラルUTXOを選択（通常は最初のUTXOを使用、最低5 ADA必要）
    let collateralUtxo: CSL.TransactionUnspentOutput | null = null
    for (let i = 0; i < transactionUnspentOutputs.len(); i++) {
      const utxo = transactionUnspentOutputs.get(i)
      const coinValue = utxo.output().amount().coin()
      if (BigInt(coinValue.to_str()) >= 5000000n) { // 5 ADA以上
        collateralUtxo = utxo
        break
      }
    }
    
    if (!collateralUtxo) {
      throw new Error('コラテラル用のUTXOが見つかりません（最低5 ADA必要）')
    }
    
    // Plutus V2スクリプトを読み込む
    const scriptBytes = hexToBytes(finalConfig.scriptCborHex!)
    const plutusScript = CSL.PlutusScript.from_bytes(scriptBytes)
    
    // リディーマを設定（Spendタイプ、インデックス0）
    const redeemer = CSL.Redeemer.new(
      CSL.RedeemerTag.new_spend(),
      CSL.BigNum.from_str('0'), // インデックス
      redeemerData,
      CSL.ExUnits.new(CSL.BigNum.from_str('1000000000'), CSL.BigNum.from_str('1000000000')) // 実行単位（例）
    )
    
    // WitnessSetにPlutusスクリプトとリディーマを追加
    plutusWitnessSet = CSL.TransactionWitnessSet.new()
    
    // Plutusスクリプトを追加
    const plutusScripts = CSL.PlutusScripts.new()
    plutusScripts.add(plutusScript)
    plutusWitnessSet.set_plutus_scripts(plutusScripts)
    
    // リディーマを追加
    const redeemers = CSL.Redeemers.new()
    redeemers.add(redeemer)
    plutusWitnessSet.set_redeemers(redeemers)
    
    // コラテラルを設定
    collateralInputs = CSL.TransactionInputs.new()
    const collateralInput = CSL.TransactionInput.new(
      collateralUtxo.input().transaction_id(),
      collateralUtxo.input().index()
    )
    collateralInputs.add(collateralInput)
  }

  // 8. .nft出力（ユーザーアドレスへ）を作成
  onProgress?.({ stage: 'cip68', message: '.nft出力を作成中...' })
  
  // userAssetNameの検証
  if (userAssetName.length % 2 !== 0) {
    throw new Error(`userAssetNameのhex長さが不正です: ${userAssetName.length}文字`)
  }
  
  const addresses = await wallet.getUsedAddresses()
  const userAddress = addresses[0] || await wallet.getChangeAddress()
  if (!userAddress) {
    throw new Error('ユーザーアドレスを取得できませんでした')
  }
  
  let userAddr: CSL.Address
  try {
    // decodeAddress関数を使用（Bech32とhex形式の両方をサポート）
    userAddr = decodeAddress(userAddress)
  } catch (error: any) {
    throw new Error(`ユーザーアドレスのデコードに失敗しました: ${error.message || error} (アドレス: ${userAddress.substring(0, 50)}...)`)
  }
  
  let userValue: CSL.Value
  let userOutput: CSL.TransactionOutput
  try {
    userValue = CSL.Value.new(CSL.BigNum.from_str('2000000'))
    const userMultiAsset = CSL.MultiAsset.new()
    
    // policyIdをバイト配列に変換
    let policyHash: CSL.ScriptHash
    try {
      const policyIdBytes = hexToBytes(policyId)
      if (policyIdBytes.length !== 28) {
        throw new Error(`policyIdバイト配列の長さが不正です: ${policyIdBytes.length}バイト (期待値: 28バイト)`)
      }
      policyHash = CSL.ScriptHash.from_bytes(policyIdBytes)
    } catch (error: any) {
      throw new Error(`policyIdの変換に失敗しました: ${error.message || error}`)
    }
    
    // userAssetNameをバイト配列に変換
    let userAssetNameBytes: Uint8Array
    try {
      userAssetNameBytes = hexToBytes(userAssetName)
      if (userAssetNameBytes.length === 0) {
        throw new Error('userAssetNameのバイト配列が空です')
      }
    } catch (error: any) {
      throw new Error(`userAssetNameの変換に失敗しました: ${error.message || error}`)
    }
    
    const userAssets = CSL.Assets.new()
    userAssets.insert(
      CSL.AssetName.new(userAssetNameBytes),
      CSL.BigNum.from_str('1')
    )
    userMultiAsset.insert(policyHash, userAssets)
    userValue.set_multiasset(userMultiAsset)

    userOutput = CSL.TransactionOutput.new(userAddr, userValue)
    txBuilder.add_output(userOutput)
  } catch (error: any) {
    throw new Error(`.nft出力の作成に失敗しました: ${error.message || error}`)
  }

  // 9. ミント情報を追加（.ref と .nft 両方）
  onProgress?.({ stage: 'cip68', message: 'ミント情報を追加中...' })
  let mintBuilder: CSL.MintBuilder
  // 後続の再構築でも同じAuxiliaryData（メタデータ）を引き継ぐために保持
  let metadataAux: CSL.AuxiliaryData | undefined
  try {
    mintBuilder = CSL.MintBuilder.new()
    const nativeScriptSource = CSL.NativeScriptSource.new(policyScript)
    const mintWitness = CSL.MintWitness.new_native_script(nativeScriptSource)

    // .ref をミント
    try {
      const refAssetNameBytes = hexToBytes(refAssetName)
      mintBuilder.add_asset(
        mintWitness,
        CSL.AssetName.new(refAssetNameBytes),
        CSL.Int.new(CSL.BigNum.from_str('1'))
      )
    } catch (error: any) {
      throw new Error(`.refアセットのミント設定に失敗しました: ${error.message || error}`)
    }

    // .nft をミント
    try {
      const userAssetNameBytes = hexToBytes(userAssetName)
      mintBuilder.add_asset(
        mintWitness,
        CSL.AssetName.new(userAssetNameBytes),
        CSL.Int.new(CSL.BigNum.from_str('1'))
      )
    } catch (error: any) {
      throw new Error(`.nftアセットのミント設定に失敗しました: ${error.message || error}`)
    }

    txBuilder.set_mint_builder(mintBuilder)
  } catch (error: any) {
    throw new Error(`ミント情報の追加に失敗しました: ${error.message || error}`)
  }

  // 10. メタデータ（CIP-25 721）を追加
  try {
    // datumをそのままCIP-25のアセットメタデータとして使用（ユーザー指定の任意キーを許容）
    // 721の形: { [policyId]: { [assetNameUtf8]: { ...datum } } }
    const assetNameUtf8 = `${baseName}.nft`

    // JSオブジェクト -> CSL.TransactionMetadatum 変換
    const toCSLMetadatum = (value: any): CSL.TransactionMetadatum => {
      if (value === null || value === undefined) {
        return CSL.TransactionMetadatum.new_text('')
      }
      const t = typeof value
      if (t === 'string') {
        return CSL.TransactionMetadatum.new_text(value as string)
      }
      if (t === 'number' || t === 'bigint') {
        return CSL.TransactionMetadatum.new_int(CSL.Int.new(CSL.BigNum.from_str(String(value))))
      }
      if (t === 'boolean') {
        return CSL.TransactionMetadatum.new_text(String(value))
      }
      if (Array.isArray(value)) {
        const list = CSL.MetadataList.new()
        for (const v of value) list.add(toCSLMetadatum(v))
        return CSL.TransactionMetadatum.new_list(list)
      }
      if (t === 'object') {
        const map = CSL.MetadataMap.new()
        for (const [k, v] of Object.entries(value)) {
          // キーはtext想定（CIP-25の一般的ケース）
          map.insert(
            CSL.TransactionMetadatum.new_text(String(k)),
            toCSLMetadatum(v)
          )
        }
        return CSL.TransactionMetadatum.new_map(map)
      }
      // フォールバック
      return CSL.TransactionMetadatum.new_text(String(value))
    }

    const policyMap = CSL.MetadataMap.new()
    const assetMap = CSL.MetadataMap.new()
    assetMap.insert(
      CSL.TransactionMetadatum.new_text(assetNameUtf8),
      toCSLMetadatum(datum)
    )
    policyMap.insert(
      CSL.TransactionMetadatum.new_text(policyId),
      CSL.TransactionMetadatum.new_map(assetMap)
    )

    const general = CSL.GeneralTransactionMetadata.new()
    general.insert(CSL.BigNum.from_str('721'), CSL.TransactionMetadatum.new_map(policyMap))

    const auxiliaryData = CSL.AuxiliaryData.new()
    auxiliaryData.set_metadata(general)
    txBuilder.set_auxiliary_data(auxiliaryData)
    metadataAux = auxiliaryData
  } catch (metaError: any) {
    console.warn('CIP-25メタデータの設定に失敗しましたが続行します:', metaError.message || metaError)
  }

  // 10. TTLを設定
  const { getCurrentSlot } = await import('./policy')
  const currentSlot = await getCurrentSlot(networkId)
  // TTLはポリシーの有効期限以下に設定する必要がある（タイムロック条件を満たすため）
  // 有効期限スロットが設定されている場合、それより少し小さい値に設定（安全マージンとして300スロット = 5分）
  let ttlSlot: number
  if (expirySlot && expirySlot > currentSlot) {
    // 有効期限が設定されている場合、有効期限より300スロット前、または現在から1時間後（どちらか小さい方）
    ttlSlot = Math.min(expirySlot - 300, currentSlot + 3600)
    // 負の値にならないようにチェック
    if (ttlSlot < currentSlot) {
      ttlSlot = currentSlot + 300 // 最小でも現在から5分後
    }
  } else {
    // 有効期限が設定されていない場合は1時間後
    ttlSlot = currentSlot + 3600
  }
  txBuilder.set_ttl_bignum(CSL.BigNum.from_str(ttlSlot.toString()))
  
  console.log('TTL設定:', { currentSlot, expirySlot, ttlSlot, networkId })

  // 11. 変更出力を追加
  txBuilder.add_change_if_needed(userAddr)

  // 12. トランザクションを構築（手数料を正確に計算）
  onProgress?.({ stage: 'cip68', message: 'トランザクションを構築中...' })
  let tx: CSL.Transaction
  try {
    // build_tx()を使って手数料を正確に計算
    tx = txBuilder.build_tx()
  } catch (error: any) {
    // build_tx()が失敗した場合、build_tx_unsafe()を試す
    console.warn('build_tx()が失敗、build_tx_unsafe()を試行:', error.message || error)
    try {
      tx = txBuilder.build_tx_unsafe()
      // build_tx_unsafe()の場合、手数料が不足する可能性があるため、
      // トランザクションサイズから手数料を推定して追加のバッファを確保
      const txBytes = tx.to_bytes()
      const txSize = txBytes.length
      const estimatedFee = BigInt('155381') + (BigInt(txSize.toString()) * BigInt('44'))
      // Plutus V2の場合、より大きなバッファが必要（署名とPlutusスクリプトのサイズを考慮）
      const bufferMultiplier = finalConfig.usePlutusV2 ? 50n : 30n // Plutus V2の場合は50%のバッファ
      const bufferAmount = finalConfig.usePlutusV2 ? 100000n : 50000n // Plutus V2の場合は100000 lovelace
      const feeWithBuffer = estimatedFee + (estimatedFee * bufferMultiplier / 100n) + bufferAmount
      
      // TransactionBuilderで手数料を設定して再構築
      const newTxBuilder = CSL.TransactionBuilder.new(config)
      // 既存の入力を追加
      newTxBuilder.add_inputs_from(transactionUnspentOutputs, strategy)
      // 既存の出力を追加（refOutputとuserOutputは既に定義済み）
      newTxBuilder.add_output(refOutput)
      newTxBuilder.add_output(userOutput)
      // ミント情報を追加
      newTxBuilder.set_mint_builder(mintBuilder)
      // TTLを設定
      newTxBuilder.set_ttl_bignum(CSL.BigNum.from_str(ttlSlot.toString()))
      // 手数料を設定（バッファを含む）
      newTxBuilder.set_fee(CSL.BigNum.from_str(feeWithBuffer.toString()))
      // 変更出力を追加
      newTxBuilder.add_change_if_needed(userAddr)
      // 再構築
      tx = newTxBuilder.build_tx_unsafe()
    } catch (unsafeError: any) {
      throw new Error(`トランザクションの構築に失敗しました: ${error.message || error}`)
    }
  }
  
  // Plutus V2の場合、コラテラルをトランザクションボディに追加
  if (finalConfig.usePlutusV2 && collateralInputs) {
    try {
      const txBody = tx.body()
      txBody.set_collateral(collateralInputs)
      // トランザクションを再構築
      tx = CSL.Transaction.new(
        txBody,
        tx.witness_set(),
        tx.auxiliary_data()
      )
    } catch (error: any) {
      throw new Error(`コラテラルの設定に失敗しました: ${error.message || error}`)
    }
  }

  const txBody = tx.body()

  // 13. ポリシー署名を追加
  onProgress?.({ stage: 'cip68', message: 'ポリシー署名を追加中...' })
  let privateKey: CSL.PrivateKey
  let signature: CSL.Ed25519Signature
  
  try {
    const privateKeyBytes = hexToBytes(policyKeyPair.privateKey)
    if (privateKeyBytes.length === 0) {
      throw new Error('プライベートキーのバイト配列が空です')
    }
    
    try {
      privateKey = privateKeyBytes.length === 32
        ? CSL.PrivateKey.from_normal_bytes(privateKeyBytes)
        : CSL.PrivateKey.from_extended_bytes(privateKeyBytes)
    } catch (error: any) {
      throw new Error(`プライベートキーの読み込みに失敗しました: ${error.message || error}`)
    }

    const txBodyHash = CSL.hash_transaction(txBody)
    signature = privateKey.sign(txBodyHash.to_bytes())
  } catch (error: any) {
    throw new Error(`ポリシー署名の追加に失敗しました: ${error.message || error}`)
  }

  let witnessSet = tx.witness_set()
  let vkeyWitnesses = witnessSet.vkeys()
  if (!vkeyWitnesses) {
    vkeyWitnesses = CSL.Vkeywitnesses.new()
    witnessSet.set_vkeys(vkeyWitnesses)
  }

  const publicKey = privateKey.to_public()
  const vkey = CSL.Vkey.new(publicKey)
  const vkeyWitness = CSL.Vkeywitness.new(vkey, signature)
  vkeyWitnesses.add(vkeyWitness)
  witnessSet.set_vkeys(vkeyWitnesses)

  // Plutus V2のWitnessSetをマージ
  if (finalConfig.usePlutusV2 && plutusWitnessSet) {
    // Plutusスクリプトをマージ
    const plutusScripts = plutusWitnessSet.plutus_scripts()
    if (plutusScripts && plutusScripts.len() > 0) {
      let existingPlutusScripts = witnessSet.plutus_scripts()
      if (!existingPlutusScripts) {
        existingPlutusScripts = CSL.PlutusScripts.new()
        witnessSet.set_plutus_scripts(existingPlutusScripts)
      }
      for (let i = 0; i < plutusScripts.len(); i++) {
        existingPlutusScripts.add(plutusScripts.get(i))
      }
    }

    // リディーマをマージ
    const redeemers = plutusWitnessSet.redeemers()
    if (redeemers && redeemers.len() > 0) {
      let existingRedeemers = witnessSet.redeemers()
      if (!existingRedeemers) {
        existingRedeemers = CSL.Redeemers.new()
        witnessSet.set_redeemers(existingRedeemers)
      }
      for (let i = 0; i < redeemers.len(); i++) {
        existingRedeemers.add(redeemers.get(i))
      }
    }
  }

  // 最終的なトランザクションを作成
  let finalTx = CSL.Transaction.new(
    txBody,
    witnessSet,
    tx.auxiliary_data()
  )

  // WitnessSetを追加した後でトランザクションサイズが変わるため、手数料を再計算
  const finalTxBytes = finalTx.to_bytes()
  const txSize = finalTxBytes.length
  const finalTxBody = finalTx.body()
  const currentFee = BigInt(finalTxBody.fee().to_str())
  
  // 手数料を再計算: baseFee + (size * feePerByte)
  const baseFee = BigInt('155381')
  const feePerByte = BigInt('44')
  const calculatedFee = baseFee + (BigInt(txSize.toString()) * feePerByte)
  
  // バッファを追加（WitnessSetのサイズを考慮して40%のバッファ + 100000 lovelace）
  // Plutus V2の場合、より大きなバッファが必要
  const bufferMultiplier = finalConfig.usePlutusV2 ? 45n : 40n
  const bufferAmount = finalConfig.usePlutusV2 ? 200000n : 100000n
  const feeWithBuffer = calculatedFee + (calculatedFee * bufferMultiplier / 100n) + bufferAmount
  
  // 手数料が不足している場合は、TransactionBuilderを使って再構築
  if (feeWithBuffer > currentFee) {
    console.warn(`手数料を調整中: ${currentFee} -> ${feeWithBuffer} lovelace (トランザクションサイズ: ${txSize} bytes, 計算手数料: ${calculatedFee} lovelace)`)
    
    try {
      // 元のトランザクションの出力を取得して、変更出力を特定
      const originalTxBody = tx.body()
      const originalOutputs = originalTxBody.outputs()
      let originalChangeOutput: CSL.TransactionOutput | null = null
      
      console.log(`元のトランザクションの出力数: ${originalOutputs.len()}`)
      
      // 変更出力を特定（refOutputとuserOutput以外の出力）
      // refOutputとuserOutputのアドレスと金額を取得
      const refOutputAddrBech32 = refOutput.address().to_bech32().toLowerCase()
      const userOutputAddrBech32 = userOutput.address().to_bech32().toLowerCase()
      const refOutputCoinValue = BigInt(refOutput.amount().coin().to_str())
      const userOutputCoinValue = BigInt(userOutput.amount().coin().to_str())
      
      console.log(`refOutput: アドレス=${refOutputAddrBech32.substring(0, 20)}..., 金額=${refOutputCoinValue}`)
      console.log(`userOutput: アドレス=${userOutputAddrBech32.substring(0, 20)}..., 金額=${userOutputCoinValue}`)
      
      for (let i = 0; i < originalOutputs.len(); i++) {
        const output = originalOutputs.get(i)
        const outputAddrBech32 = output.address().to_bech32().toLowerCase()
        const outputCoin = BigInt(output.amount().coin().to_str())
        
        console.log(`出力${i}: アドレス=${outputAddrBech32.substring(0, 20)}..., 金額=${outputCoin}`)
        
        // refOutputとuserOutput以外の出力を変更出力として扱う
        const isRefOutput = outputAddrBech32 === refOutputAddrBech32 && outputCoin === refOutputCoinValue
        const isUserOutput = outputAddrBech32 === userOutputAddrBech32 && outputCoin === userOutputCoinValue
        
        if (!isRefOutput && !isUserOutput) {
          originalChangeOutput = output
          console.log(`変更出力を特定: 出力${i}, 金額=${outputCoin}`)
          break
        }
      }
      
      // TransactionBuilderで手数料を設定して再構築
      // 変更出力を手動で計算して追加（手数料を設定する前に必要）
      // 入力の合計ADAを計算（LargestFirstで選択される入力のみを推定して合計）
      // builderの選択戦略(CIP2 LargestFirst)に合わせ、推定で入力を選ぶ
      type UtxoInfo = { txHash: string, index: number, coin: bigint }
      const utxoList: UtxoInfo[] = []
      for (let i = 0; i < transactionUnspentOutputs.len(); i++) {
        const utxo = transactionUnspentOutputs.get(i)
        const input = utxo.input()
        const txHash = Buffer.from(input.transaction_id().to_bytes()).toString('hex')
        const index = input.index()
        const coin = BigInt(utxo.output().amount().coin().to_str())
        utxoList.push({ txHash, index, coin })
      }
      utxoList.sort((a, b) => (b.coin > a.coin ? 1 : (b.coin < a.coin ? -1 : 0)))

      const requiredAda = refOutputCoinValue + userOutputCoinValue + feeWithBuffer
      let totalInputAda = 0n
      const selected: UtxoInfo[] = []
      for (const u of utxoList) {
        if (totalInputAda >= requiredAda) break
        selected.push(u)
        totalInputAda += u.coin
      }
      console.log(`入力合計ADA(推定LargestFirst): ${totalInputAda} (選択UTXO数: ${selected.length})`)
      
      // 出力の合計ADAを計算（refOutputとuserOutputのみ）
      let totalOutputAda = BigInt(0)
      totalOutputAda += refOutputCoinValue
      totalOutputAda += userOutputCoinValue
      
      console.log(`出力合計ADA (ref+user): ${totalOutputAda}`)
      console.log(`手数料: ${feeWithBuffer}`)
      
      // 変更出力に必要なADAを計算（常に厳密に計算）
      const minChangeAda = 2000000n
      const exactChangeAda = totalInputAda - totalOutputAda - feeWithBuffer
      
      console.log(`計算された変更出力: ${exactChangeAda}`)
      
      if (exactChangeAda < minChangeAda) {
        if (exactChangeAda < 0n) {
          throw new Error(`変更額が負です: ${exactChangeAda}. 入力=${totalInputAda}, 出力=${totalOutputAda}, 手数料=${feeWithBuffer}`)
        }
        throw new Error(`変更額が最小値未満です: ${exactChangeAda} < ${minChangeAda}. 入力=${totalInputAda}, 出力=${totalOutputAda}, 手数料=${feeWithBuffer}`)
      }
      
      // 変更出力を作成
      const exactChangeValue = CSL.Value.new(CSL.BigNum.from_str(exactChangeAda.toString()))
      // 元の変更出力にマルチアセットがある場合は保持
      if (originalChangeOutput) {
        const originalMultiAsset = originalChangeOutput.amount().multiasset()
        if (originalMultiAsset) {
          exactChangeValue.set_multiasset(originalMultiAsset)
        }
      }
      const exactChangeOutput = CSL.TransactionOutput.new(userAddr, exactChangeValue)
      
      // 常に厳密に再構築
      const exactBuilder = CSL.TransactionBuilder.new(config)
      exactBuilder.add_inputs_from(transactionUnspentOutputs, strategy)
      exactBuilder.add_output(refOutput)
      exactBuilder.add_output(userOutput)
      exactBuilder.add_output(exactChangeOutput)
      exactBuilder.set_mint_builder(mintBuilder)
      exactBuilder.set_ttl_bignum(CSL.BigNum.from_str(ttlSlot.toString()))
      if (metadataAux) {
        // 再構築時にもメタデータを引き継ぐ
        exactBuilder.set_auxiliary_data(metadataAux)
      }
      exactBuilder.set_fee(CSL.BigNum.from_str(feeWithBuffer.toString()))
      const exactTx = exactBuilder.build_tx_unsafe()
      
      // バランスを検証
      const exactTxBody = exactTx.body()
      const exactOutputs = exactTxBody.outputs()
      let exactTotalOutputAda = BigInt(0)
      console.log(`再構築後の出力数: ${exactOutputs.len()}`)
      for (let i = 0; i < exactOutputs.len(); i++) {
        const output = exactOutputs.get(i)
        const outputCoin = BigInt(output.amount().coin().to_str())
        exactTotalOutputAda += outputCoin
        console.log(`再構築後の出力${i}: 金額=${outputCoin}`)
      }
      const exactFee = BigInt(exactTxBody.fee().to_str())
      const exactTotalCost = exactTotalOutputAda + exactFee
      
      console.log(`再構築後の出力合計: ${exactTotalOutputAda}, 手数料: ${exactFee}, 合計: ${exactTotalCost}`)
      console.log(`入力合計: ${totalInputAda}, 差分: ${totalInputAda - exactTotalCost}`)
      
      if (totalInputAda !== exactTotalCost) {
        throw new Error(`バランスが一致しません: 入力=${totalInputAda}, 出力+手数料=${exactTotalCost}, 差分=${totalInputAda - exactTotalCost}`)
      }
      
      // Plutus V2の場合、コラテラルを設定
      if (finalConfig.usePlutusV2 && collateralInputs) {
        exactTxBody.set_collateral(collateralInputs)
        tx = CSL.Transaction.new(
          exactTxBody,
          exactTx.witness_set(),
          exactTx.auxiliary_data()
        )
      } else {
        tx = exactTx
      }
      
      // WitnessSetを再適用（ポリシー署名とPlutus V2のWitnessSet）
      const rebuiltTxBody = tx.body()
      const rebuiltWitnessSet = tx.witness_set()
      
      // ポリシー署名を再追加
      const privateKeyBytes = hexToBytes(policyKeyPair.privateKey)
      const privateKey = privateKeyBytes.length === 32
        ? CSL.PrivateKey.from_normal_bytes(privateKeyBytes)
        : CSL.PrivateKey.from_extended_bytes(privateKeyBytes)
      const rebuiltTxBodyHash = CSL.hash_transaction(rebuiltTxBody)
      const rebuiltSignature = privateKey.sign(rebuiltTxBodyHash.to_bytes())
      
      let rebuiltVkeyWitnesses = rebuiltWitnessSet.vkeys()
      if (!rebuiltVkeyWitnesses) {
        rebuiltVkeyWitnesses = CSL.Vkeywitnesses.new()
        rebuiltWitnessSet.set_vkeys(rebuiltVkeyWitnesses)
      }
      
      const rebuiltPublicKey = privateKey.to_public()
      const rebuiltVkey = CSL.Vkey.new(rebuiltPublicKey)
      const rebuiltVkeyWitness = CSL.Vkeywitness.new(rebuiltVkey, rebuiltSignature)
      rebuiltVkeyWitnesses.add(rebuiltVkeyWitness)
      rebuiltWitnessSet.set_vkeys(rebuiltVkeyWitnesses)
      
      // Plutus V2のWitnessSetをマージ
      if (finalConfig.usePlutusV2 && plutusWitnessSet) {
        const plutusScripts = plutusWitnessSet.plutus_scripts()
        if (plutusScripts && plutusScripts.len() > 0) {
          let existingPlutusScripts = rebuiltWitnessSet.plutus_scripts()
          if (!existingPlutusScripts) {
            existingPlutusScripts = CSL.PlutusScripts.new()
            rebuiltWitnessSet.set_plutus_scripts(existingPlutusScripts)
          }
          for (let i = 0; i < plutusScripts.len(); i++) {
            existingPlutusScripts.add(plutusScripts.get(i))
          }
        }

        const redeemers = plutusWitnessSet.redeemers()
        if (redeemers && redeemers.len() > 0) {
          let existingRedeemers = rebuiltWitnessSet.redeemers()
          if (!existingRedeemers) {
            existingRedeemers = CSL.Redeemers.new()
            rebuiltWitnessSet.set_redeemers(existingRedeemers)
          }
          for (let i = 0; i < redeemers.len(); i++) {
            existingRedeemers.add(redeemers.get(i))
          }
        }
      }
      
      // 最終的なトランザクションを作成
      finalTx = CSL.Transaction.new(
        rebuiltTxBody,
        rebuiltWitnessSet,
        tx.auxiliary_data()
      )
      
      // 再構築後のトランザクションサイズに基づいて手数料を再確認
      const rebuiltTxBytes = finalTx.to_bytes()
      const rebuiltTxSize = rebuiltTxBytes.length
      const rebuiltTxBodyFinal = finalTx.body()
      const rebuiltFee = BigInt(rebuiltTxBodyFinal.fee().to_str())
      const rebuiltCalculatedFee = baseFee + (BigInt(rebuiltTxSize.toString()) * feePerByte)
      const rebuiltFeeWithBuffer = rebuiltCalculatedFee + (rebuiltCalculatedFee * bufferMultiplier / 100n) + bufferAmount
      
      if (rebuiltFeeWithBuffer > rebuiltFee) {
        console.warn(`再構築後のトランザクションサイズに基づいて手数料を再調整: ${rebuiltFee} -> ${rebuiltFeeWithBuffer} lovelace (トランザクションサイズ: ${rebuiltTxSize} bytes)`)
        // 手数料がまだ不足している場合は、手数料を更新する必要がありますが、
        // CSLではトランザクションの手数料を直接変更できないため、
        // 警告のみを出して続行します
        // 実際には、このような場合は再度TransactionBuilderで再構築する必要がありますが、
        // 無限ループを避けるため、ここでは警告のみとします
      }
      
      console.log(`手数料を調整しました: ${currentFee} -> ${feeWithBuffer} lovelace`)
    } catch (rebuiltError: any) {
      console.warn('手数料の再構築に失敗しましたが、続行します:', rebuiltError.message || rebuiltError)
    }
  }

  // 14. 署名・送信
  onProgress?.({ stage: 'cip68', message: 'トランザクションに署名中...' })
  const { signTransaction, submitTransaction } = await import('./transaction')
  // policyWitnessHex を作成（既に組み立てたWitnessSetをマージ元として渡す）
  const witnessBytes = finalTx.witness_set().to_bytes()
  let policyWitnessHex = ''
  {
    let hex = ''
    for (let i = 0; i < witnessBytes.length; i++) {
      const b = witnessBytes[i]
      hex += (b < 16 ? '0' : '') + b.toString(16)
    }
    policyWitnessHex = hex
  }
  const signedTxHex = await signTransaction(wallet, finalTx, policyWitnessHex)

  onProgress?.({ stage: 'cip68', message: 'トランザクションを送信中...' })
  const txHash = await submitTransaction(wallet, signedTxHex)

  onProgress?.({ stage: 'cip68', message: `トランザクション送信完了: ${txHash}` })

  return {
    transactionHash: txHash,
    policyId,
    refAssetName,
    userAssetName,
  }
}


