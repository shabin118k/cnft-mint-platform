// Cardanoトランザクション構築関連のユーチE��リチE��関数
// @emurgo/cardano-serialization-libを使用
// 注意: このモジュールはクライアントサイド（ブラウザ）でのみ使用可能です

import * as CSL from '@emurgo/cardano-serialization-lib-browser'
import { getCurrentSlot } from './policy'

/**
 * UTXO惁E��
 */
export interface UTXO {
  txHash: string
  outputIndex: number
  amount: bigint // lovelace
  assets?: Map<string, bigint> // assetId -> quantity
}

/**
 * トランザクション構築パラメータ
 */
export interface BuildTransactionParams {
  wallet: any // CardanoウォレチE��API
  outputs: Array<{
    address: string
    amount: bigint // lovelace
    assets?: Array<{
      policyId: string
      assetName: string
      quantity: bigint
    }>
  }>
  metadata?: object // CIP-25メタデータ (label 721)
  extraMetadata?: Record<string | number, any> // 任意メタデータ (数値ラベル推奨)
  changeAddress?: string // 変更出力アドレス�E�省略時�EウォレチE��から取得！E
  policyId?: string // ポリシーID�E�ミント用�E�E
  policyScript?: any // CSL.NativeScript�E�ミント用�E�E
  policyKey?: string // hex形式�E秘寁E���E�署名用�E�E
  mintAssets?: Array<{
    policyId: string
    assetName: string
    quantity: bigint
  }>
  networkId?: number // ネットワークID (0: Testnet, 1: Mainnet)
}

/**
 * トランザクション構築結果
 */
export interface BuildTransactionResult {
  transactionBody: any // CSL.TransactionBody
  transaction: any // CSL.Transaction
  signedTransaction?: any // CSL.Transaction�E�署名済み�E�E
  cborHex: string // CBORエンコードされたトランザクション�E�E6進数�E�E
  policyWitnessHex?: string
}

/**
 * アドレスをデコード！Eech32また�Ehex斁E���E�E�E
 */
export function decodeAddress(address: string): CSL.Address {
  if (typeof window === 'undefined') {
    throw new Error('decodeAddressはブラウザ環境でのみ使用可能です')
  }

  try {
    // まずbech32形式として試衁E
    return CSL.Address.from_bech32(address)
  } catch (bech32Error: any) {
    console.warn('bech32アドレスとしてのチE��ードに失敗しました。hexとして再試行しまぁE..', {
      address,
      error: bech32Error?.message || bech32Error,
    })

    // hex斁E���EかどぁE��を判宁E
    if (/^[0-9a-fA-F]+$/.test(address)) {
      if (address.length % 2 !== 0) {
        throw new Error(`アドレスhex文字列の長さが奇数です: ${address.length}`)
      }

      try {
        const addressBytes = hexToBytes(address)
        const decodedAddress = CSL.Address.from_bytes(addressBytes)
        console.log('hex斁E���EアドレスのチE��ードに成功しました')
        return decodedAddress
      } catch (hexError: any) {
        console.error('hexアドレスのチE��ードに失敗しました', {
          address,
          error: hexError?.message || hexError,
        })
        throw new Error(`アドレスのチE��ードに失敗しました�E�Eex形式！E ${hexError?.message || hexError}`)
      }
    }

    throw new Error(`アドレスのチE��ードに失敗しました�E�Eech32形式！E ${bech32Error?.message || bech32Error}`)
  }
}

/**
 * hex斁E���Eをバイト�E列に変換
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

/**
 * バイト�E列をhex斁E���Eに変換
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * base64斁E���Eをバイト�E列に変換
 */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof window !== 'undefined' && window.atob) {
    const binaryString = window.atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } else {
    // Node.js環境
    const Buffer = require('buffer').Buffer
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }
}

/**
 * UTXO斁E���Eをパース�E�ウォレチE��APIから返される形式を判定！E
 * 形弁E: "txHash#index" (シンプルな形弁E
 * 形弁E: CBORエンコードされた形弁E(base64また�Ehex)
 */
function parseUTXO(utxoString: string): { txHash: string; index: number } {
  // 形弁E: "txHash#index"を試ぁE
  if (utxoString.includes('#')) {
    const [txHash, index] = utxoString.split('#')
    // txHashぁE4斁E��！E2バイト�Ehex�E��E場吁E
    if (txHash.length === 64 && /^[0-9a-fA-F]+$/.test(txHash)) {
      return {
        txHash,
        index: parseInt(index, 10),
      }
    }
  }
  
  // 形弁E: CBORエンコードされた形式�E場吁E
  try {
    // base64形式かhex形式かを判宁E
    let utxoBytes: Uint8Array
    
    if (/^[A-Za-z0-9+/=]+$/.test(utxoString) && utxoString.length > 64) {
      // base64形式�E可能性
      utxoBytes = base64ToBytes(utxoString)
    } else if (/^[0-9a-fA-F]+$/.test(utxoString) && utxoString.length > 64) {
      // hex形式�E可能性
      utxoBytes = hexToBytes(utxoString)
    } else {
      throw new Error('UTXO文字列のフォーマットが不明です')
    }
    
    // CBORエンコードされたUTXOをデコーチE
    // 注愁E 実際の実裁E��は、CSLを使用してCBORをデコードする忁E��がありまぁE
    // ここでは簡易実裁E��して、UTXO斁E���Eをそのまま使用する
    throw new Error('CBOR形式�EUTXOは現在サポ�EトされてぁE��せん。ウォレチE��APIから"txHash#index"形式でUTXOを取得してください')
    
  } catch (error: any) {
    throw new Error(`UTXO斁E���Eのパ�Eスに失敗しました: ${utxoString} - ${error.message || error}`)
  }
}

/**
 * ウォレチE��からUTXOを取征E
 */
export async function getUTXOs(wallet: any): Promise<string[]> {
  if (typeof window === 'undefined') {
    throw new Error('getUTXOsはブラウザ環境でのみ使用可能です')
  }
  
  try {
    const utxos = await wallet.getUtxos()
    
    if (!utxos || !Array.isArray(utxos)) {
      return []
    }
    
    // UTXOフォーマットを確認してログ出力（デバッグ用�E�E
    if (utxos.length > 0) {
      console.log('UTXOサンプル:', utxos[0], 'タイチE', typeof utxos[0], '長ぁE', utxos[0]?.length)
    }
    
    return utxos
  } catch (error: any) {
    throw new Error(`UTXOの取得に失敗しました: ${error.message || error}`)
  }
}

/**
 * 最小限のUTXOを選択（忁E��な額を満たす�E�E
 */
export function selectUTXOs(
  utxos: string[],
  requiredAmount: bigint
): string[] {
  // 簡易実裁E 最初から頁E��選抁E
  // 実際の実裁E��は、最適化アルゴリズムを使用することを推奨
  const selected: string[] = []
  let totalAmount = 0n
  
  for (const utxo of utxos) {
    selected.push(utxo)
    // 注愁E 実際にはUTXOから金額を取得する忁E��がありまぁE
    // ここでは簡易的に、E��択したUTXOの数から推宁E
    totalAmount += 1000000n // 仮の金額！E ADA�E�E
    
    if (totalAmount >= requiredAmount) {
      break
    }
  }
  
  if (totalAmount < requiredAmount) {
    throw new Error('残高が不足しています')
  }
  
  return selected
}

/**
 * CIP-25メタチE�EタをCSLメタチE�Eタに変換
 */
export function createMetadataCBOR(metadata: object): CSL.GeneralTransactionMetadata {
  if (typeof window === 'undefined') {
    throw new Error('createMetadataCBORはブラウザ環境でのみ使用可能です')
  }
  
  function toMetadatum(value: any): CSL.TransactionMetadatum {
    if (typeof value === 'string') {
      return CSL.TransactionMetadatum.new_text(value)
    }

    if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        return CSL.TransactionMetadatum.new_text(value.toString())
      }
      if (value >= 0) {
        if (value <= Number.MAX_SAFE_INTEGER) {
          return CSL.TransactionMetadatum.new_int(
            CSL.Int.new(CSL.BigNum.from_str(value.toString()))
          )
        }
        return CSL.TransactionMetadatum.new_text(value.toString())
      }
      const positive = Math.abs(value)
      if (positive <= Number.MAX_SAFE_INTEGER) {
        return CSL.TransactionMetadatum.new_int(
          CSL.Int.new_negative(CSL.BigNum.from_str(positive.toString()))
        )
      }
      return CSL.TransactionMetadatum.new_text(value.toString())
    }

    if (typeof value === 'bigint') {
      const bigStr = value.toString()
      if (value >= 0n) {
        return CSL.TransactionMetadatum.new_int(
          CSL.Int.new(CSL.BigNum.from_str(bigStr))
        )
      }
      return CSL.TransactionMetadatum.new_int(
        CSL.Int.new_negative(CSL.BigNum.from_str(bigStr.slice(1)))
      )
    }

    if (typeof value === 'boolean') {
      return CSL.TransactionMetadatum.new_int(
        CSL.Int.new_i32(value ? 1 : 0)
      )
    }

    if (Array.isArray(value)) {
      const list = CSL.MetadataList.new()
      value.forEach((item) => {
        list.add(toMetadatum(item))
      })
      return CSL.TransactionMetadatum.new_list(list)
    }

    if (value && typeof value === 'object') {
      const map = CSL.MetadataMap.new()
      Object.entries(value).forEach(([key, val]) => {
        map.insert(
          CSL.TransactionMetadatum.new_text(key.toString()),
          toMetadatum(val)
        )
      })
      return CSL.TransactionMetadatum.new_map(map)
    }

    return CSL.TransactionMetadatum.new_text('')
  }

  const policyMap = CSL.MetadataMap.new()

  Object.entries(metadata).forEach(([policyId, assets]) => {
    const assetMap = CSL.MetadataMap.new()
    Object.entries(assets as Record<string, any>).forEach(([assetName, fields]) => {
      assetMap.insert(
        CSL.TransactionMetadatum.new_text(assetName),
        toMetadatum(fields)
      )
    })
    policyMap.insert(
      CSL.TransactionMetadatum.new_text(policyId),
      CSL.TransactionMetadatum.new_map(assetMap)
    )
  })

  const generalMetadata = CSL.GeneralTransactionMetadata.new()
  generalMetadata.insert(
    CSL.BigNum.from_str('721'),
    CSL.TransactionMetadatum.new_map(policyMap)
  )

  return generalMetadata
}

/**
 * 任意のJS値をCSLメタデータに変換（再利用可能）
 */
function toCSLMetadatum(value: any): CSL.TransactionMetadatum {
  if (typeof value === 'string') {
    return CSL.TransactionMetadatum.new_text(value)
  }

  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return CSL.TransactionMetadatum.new_text(value.toString())
    }
    if (value >= 0) {
      if (value <= Number.MAX_SAFE_INTEGER) {
        return CSL.TransactionMetadatum.new_int(
          CSL.Int.new(CSL.BigNum.from_str(value.toString()))
        )
      }
      return CSL.TransactionMetadatum.new_text(value.toString())
    }
    const positive = Math.abs(value)
    if (positive <= Number.MAX_SAFE_INTEGER) {
      return CSL.TransactionMetadatum.new_int(
        CSL.Int.new_negative(CSL.BigNum.from_str(positive.toString()))
      )
    }
    return CSL.TransactionMetadatum.new_text(value.toString())
  }

  if (typeof value === 'bigint') {
    const bigStr = value.toString()
    if (value >= 0n) {
      return CSL.TransactionMetadatum.new_int(
        CSL.Int.new(CSL.BigNum.from_str(bigStr))
      )
    }
    return CSL.TransactionMetadatum.new_int(
      CSL.Int.new_negative(CSL.BigNum.from_str(bigStr.slice(1)))
    )
  }

  if (typeof value === 'boolean') {
    return CSL.TransactionMetadatum.new_int(
      CSL.Int.new_i32(value ? 1 : 0)
    )
  }

  if (Array.isArray(value)) {
    const list = CSL.MetadataList.new()
    value.forEach((item) => {
      list.add(toCSLMetadatum(item))
    })
    return CSL.TransactionMetadatum.new_list(list)
  }

  if (value && typeof value === 'object') {
    const map = CSL.MetadataMap.new()
    Object.entries(value).forEach(([key, val]) => {
      map.insert(
        CSL.TransactionMetadatum.new_text(key.toString()),
        toCSLMetadatum(val)
      )
    })
    return CSL.TransactionMetadatum.new_map(map)
  }

  return CSL.TransactionMetadatum.new_text('')
}

/**
 * CIP-25 (721) のメタデータ本体を構築して返す
 */
function build721Metadatum(metadata: object): CSL.TransactionMetadatum {
  const policyMap = CSL.MetadataMap.new()
  Object.entries(metadata).forEach(([policyId, assets]) => {
    const assetMap = CSL.MetadataMap.new()
    Object.entries(assets as Record<string, any>).forEach(([assetName, fields]) => {
      assetMap.insert(
        CSL.TransactionMetadatum.new_text(assetName),
        toCSLMetadatum(fields)
      )
    })
    policyMap.insert(
      CSL.TransactionMetadatum.new_text(policyId),
      CSL.TransactionMetadatum.new_map(assetMap)
    )
  })
  return CSL.TransactionMetadatum.new_map(policyMap)
}

/**
 * トランザクションを構篁E
 */
export async function buildTransaction(
  params: BuildTransactionParams
): Promise<BuildTransactionResult> {
  if (typeof window === 'undefined') {
    throw new Error('buildTransactionはブラウザ環境でのみ使用可能です')
  }
  
  const { wallet, outputs, metadata, changeAddress, policyId, policyScript, policyKey, mintAssets, networkId = 0 } = params
  
  try {
    // 1. UTXOを取征E
    const utxos = await getUTXOs(wallet)
    
    if (utxos.length === 0) {
      throw new Error('利用可能なUTXOが見つかりません')
    }
    
    console.log('取得したUTXO:', utxos.length, '個')
    console.log('最初のUTXOの詳細:', {
      utxo: utxos[0],
      type: typeof utxos[0],
      length: typeof utxos[0] === 'string' ? utxos[0].length : 'N/A',
      firstChars: typeof utxos[0] === 'string' ? utxos[0].substring(0, 100) : 'N/A',
    })
    
    // 2. 忁E��E��を計箁E
    const requiredAmount = outputs.reduce((sum, output) => sum + output.amount, 0n)
    const feeEstimate = 200000n // 仮の固定手数斁E
    const requiredWithFee = requiredAmount + feeEstimate
 
     // 4. トランザクション出力を作成（後でTransactionBuilderに追加）
    // 5. UTXOをTransactionUnspentOutputとして解极E
    const transactionUnspentOutputs = CSL.TransactionUnspentOutputs.new()
    let totalInputLovelace = 0n
    
    for (const utxoString of utxos) {
      try {
        let utxo: CSL.TransactionUnspentOutput | null = null
        
        // UTXOが文字�Eの場合！EBORエンコードされた形式！E
        if (typeof utxoString === 'string') {
          // hex形式�ECBORエンコードされたUTXOをデコーチE
          if (utxoString.length > 64 && /^[0-9a-fA-F]+$/.test(utxoString)) {
            const utxoBytes = hexToBytes(utxoString)
            try {
              utxo = CSL.TransactionUnspentOutput.from_bytes(utxoBytes)
            } catch (cborError: any) {
              // 配�E形式�E場合�EスキチE�E�E�後で処琁E��E
              console.warn('TransactionUnspentOutputとしてチE��ード失敁E', cborError.message || cborError)
            }
          } else if (/^[A-Za-z0-9+/=]+$/.test(utxoString) && utxoString.length > 64) {
            // base64形弁E
            const utxoBytes = base64ToBytes(utxoString)
            try {
              utxo = CSL.TransactionUnspentOutput.from_bytes(utxoBytes)
            } catch (cborError: any) {
              console.warn('base64 UTXOチE��ード失敁E', cborError.message || cborError)
            }
          }
        }
        
        if (utxo) {
          transactionUnspentOutputs.add(utxo)
          const coinValue = utxo.output().amount().coin()
          totalInputLovelace += BigInt(coinValue.to_str())
        }
      } catch (error: any) {
        console.warn(`UTXOの処琁E��失敗しました: ${error.message || error}`)
      }
    }
    
    if (transactionUnspentOutputs.len() === 0) {
      throw new Error('利用可能なUTXOが見つかりません。UTXO形式を確認してください。')
    }
    
    // 最終的な必要額は出力の最小ADAやミントに伴うお釣り構成で増える可能性があるため
    // ここでの事前チェックは行わず、Builderのコイン選択に委ねる

    for (const output of outputs) {
      try {
        console.log('トランザクション出力を作成中:', {
          address: output.address,
          addressLength: output.address?.length,
          amount: output.amount.toString(),
          assetsCount: output.assets?.length || 0,
        })

        let address: CSL.Address
        try {
          address = decodeAddress(output.address)
        } catch (addrError: any) {
          throw new Error(`アドレスのチE��ードに失敗しました: ${output.address} - ${addrError.message || addrError}`)
        }

        let value = CSL.Value.new(CSL.BigNum.from_str(output.amount.toString()))

        if (output.assets && output.assets.length > 0) {
          const multiAsset = CSL.MultiAsset.new()
          let hasAssets = false

          for (const asset of output.assets) {
            if (!asset.policyId || !asset.assetName) {
              throw new Error('アセチE��惁E��が不足してぁE��ぁE(policyId また�E assetName)')
            }

            const policyHash = CSL.ScriptHash.from_bytes(hexToBytes(asset.policyId))
            let policyAssets = multiAsset.get(policyHash)
            if (!policyAssets) {
              policyAssets = CSL.Assets.new()
              multiAsset.insert(policyHash, policyAssets)
            }

            const assetName = CSL.AssetName.new(hexToBytes(asset.assetName))
            const quantity = CSL.BigNum.from_str(asset.quantity.toString())
            policyAssets.insert(assetName, quantity)
            hasAssets = true

            console.log('Output asset inserted', {
              address: output.address,
              policyId: asset.policyId,
              assetName: asset.assetName,
              quantity: asset.quantity.toString(),
            })

            // ensure the updated assets collection is stored back in the multiAsset map
            multiAsset.insert(policyHash, policyAssets)
          }

          if (hasAssets) {
            value.set_multiasset(multiAsset)
            console.log('Output multiasset finalised', {
              address: output.address,
              multiAssetHex: bytesToHex(value.multiasset()?.to_bytes?.() ?? new Uint8Array()),
            })
          }
        }

        // この時点では出力を作成するだけ（後でTransactionBuilderに追加）
      } catch (outputError: any) {
        console.error('トランザクション出力�E構築に失敗しました:', {
          output,
          error: outputError.message || outputError,
        })
        throw new Error(`トランザクション出力�E構築に失敗しました: ${outputError.message || outputError}`)
      }
    }
    
    // 6. メタデータを追加（CIP-25 721 + 任意ラベル）
    let auxiliaryData: CSL.AuxiliaryData | undefined
    const general = CSL.GeneralTransactionMetadata.new()
    let hasAnyMetadata = false

    if (params.extraMetadata && typeof params.extraMetadata === 'object') {
      Object.entries(params.extraMetadata).forEach(([label, value]) => {
        // ラベルは数値文字列を推奨（CIP仕様）
        const labelStr = String(label)
        if (/^\d+$/.test(labelStr)) {
          const k = CSL.BigNum.from_str(labelStr)
          general.insert(k, toCSLMetadatum(value))
          hasAnyMetadata = true
        }
      })
    }

    if (metadata) {
      // 任意ラベルより後に 721 を上書き挿入（衝突時は721を優先）
      general.insert(CSL.BigNum.from_str('721'), build721Metadatum(metadata))
      hasAnyMetadata = true
    }

    if (hasAnyMetadata) {
      auxiliaryData = CSL.AuxiliaryData.new()
      auxiliaryData.set_metadata(general)
    }
    
    // 7. TransactionBuilderConfigを作成（簡易設定）
    // 注愁E 実際のプロダクションでは、ネチE��ワークに応じた適刁E��設定を使用してください
    const feeCoefficient = CSL.BigNum.from_str('44') // 44 lovelace per byte
    const feeConstant = CSL.BigNum.from_str('155381') // 155381 lovelace base fee
    const linearFee = CSL.LinearFee.new(feeCoefficient, feeConstant)
    
    const configBuilder = CSL.TransactionBuilderConfigBuilder.new()
      .fee_algo(linearFee)
      .coins_per_utxo_byte(CSL.BigNum.from_str('4310')) // 4310 lovelace per UTXO byte
      .pool_deposit(CSL.BigNum.from_str('500000000')) // 500 ADA
      .key_deposit(CSL.BigNum.from_str('2000000')) // 2 ADA
      .max_value_size(5000) // 5000 bytes
      .max_tx_size(16384) // 16 KB
    
    const config = configBuilder.build()
    
    // 8. TransactionBuilderを作成
    const txBuilder = CSL.TransactionBuilder.new(config)
    
    // 9. 入力としてUTXOを追加（TransactionBuilderが自動選択）
    // CoinSelectionStrategyCIP2を使用してUTXOを自動選択
    const strategy = CSL.CoinSelectionStrategyCIP2.LargestFirst
    txBuilder.add_inputs_from(transactionUnspentOutputs, strategy)
    
    // 10. 出力を追加
    for (const output of outputs) {
      const address = decodeAddress(output.address)
      let value = CSL.Value.new(CSL.BigNum.from_str(output.amount.toString()))
      
      if (output.assets && output.assets.length > 0) {
        const multiAsset = CSL.MultiAsset.new()
        let hasAssets = false
        
        for (const asset of output.assets) {
          const policyHash = CSL.ScriptHash.from_bytes(hexToBytes(asset.policyId))
          let policyAssets = multiAsset.get(policyHash)
          if (!policyAssets) {
            policyAssets = CSL.Assets.new()
            multiAsset.insert(policyHash, policyAssets)
          }
          
          const assetName = CSL.AssetName.new(hexToBytes(asset.assetName))
          const quantity = CSL.BigNum.from_str(asset.quantity.toString())
          policyAssets.insert(assetName, quantity)
          hasAssets = true
          
          // ensure the updated assets collection is stored back in the multiAsset map
          multiAsset.insert(policyHash, policyAssets)
        }
        
        if (hasAssets) {
          value.set_multiasset(multiAsset)
        }
      }
      
      // MultiAsset出力の最小ADAを満たすよう補正（CSLのヘルパーが無い場合は近似計算）
      try {
        const tmpOut = CSL.TransactionOutput.new(address, value)
        const byteLen = tmpOut.to_bytes().length
        const minAdaApprox = CSL.BigNum.from_str((BigInt(byteLen) * 4310n).toString())
        if (value.coin().less_than(minAdaApprox)) {
          value.set_coin(minAdaApprox)
        }
      } catch (_) {
        // 計算失敗時はそのまま続行
      }

      const txOutput = CSL.TransactionOutput.new(address, value)
      txBuilder.add_output(txOutput)
    }
    
    // 11. ミント情報を追加�E�EintBuilderを使用�E�E
    let mintBuilder: CSL.MintBuilder | undefined
    if (mintAssets && mintAssets.length > 0 && policyScript) {
      mintBuilder = CSL.MintBuilder.new()
      
      for (const asset of mintAssets) {
        const nativeScriptSource = CSL.NativeScriptSource.new(policyScript)
        const mintWitness = CSL.MintWitness.new_native_script(nativeScriptSource)
        const assetName = CSL.AssetName.new(hexToBytes(asset.assetName))
        const quantityBigInt = BigInt(asset.quantity)
        const quantityAbs = quantityBigInt >= 0n ? quantityBigInt : -quantityBigInt
        const quantityInt = quantityBigInt >= 0n
          ? CSL.Int.new(CSL.BigNum.from_str(quantityAbs.toString()))
          : CSL.Int.new_negative(CSL.BigNum.from_str(quantityAbs.toString()))
        
        mintBuilder.add_asset(mintWitness, assetName, quantityInt)
      }
      
      txBuilder.set_mint_builder(mintBuilder)
    }
    
    // 12. メタチE�Eタを追加
    if (metadata && auxiliaryData) {
      txBuilder.set_auxiliary_data(auxiliaryData)
    }
    
    // 13. TTLを設定（スロットベース）
    // 現在スロットからKoios APIで取得、1時間後のスロットに設定
    const currentSlot = await getCurrentSlot(networkId)
    const ttlSlot = currentSlot + 3600 // 1時間 = 3600スロット後
    const slot = CSL.BigNum.from_str(ttlSlot.toString())
    txBuilder.set_ttl_bignum(slot)
    
    console.log('TTL slot set:', { currentSlot, ttlSlot, networkId })
    
    // 14. 変更出力を追加
    if (changeAddress) {
      const changeAddr = decodeAddress(changeAddress)
      txBuilder.add_change_if_needed(changeAddr)
    }
    
    // 15. トランザクションを構築（手数料は自動計算）
    const tx = txBuilder.build_tx_unsafe()
    const txBody = tx.body()
    const witnessSet = tx.witness_set()
    let policyWitnessHex: string | undefined
    
    // ポリシー署名を追加�E�ミント�E場合！E
    if (policyKey && policyScript && mintBuilder) {
      try {
        const privateKeyBytes = hexToBytes(policyKey)
        let privateKey: any
        
        if (privateKeyBytes.length === 32) {
          privateKey = CSL.PrivateKey.from_normal_bytes(privateKeyBytes)
        } else {
          privateKey = CSL.PrivateKey.from_extended_bytes(privateKeyBytes)
        }
        
        // トランザクションボディのハッシュを計箁E
        const txBodyHash = CSL.hash_transaction(txBody)
        
        // 署名を作成
        const signature = privateKey.sign(txBodyHash.to_bytes())
        
        // 署名およ�EネイチE��ブスクリプトを証明書に追加
        let vkeyWitnesses = witnessSet.vkeys()
        if (!vkeyWitnesses) {
          vkeyWitnesses = CSL.Vkeywitnesses.new()
          witnessSet.set_vkeys(vkeyWitnesses)
        }
        
        const publicKey = privateKey.to_public()
        const vkey = CSL.Vkey.new(publicKey)
        const vkeyWitness = CSL.Vkeywitness.new(vkey, signature)
        vkeyWitnesses.add(vkeyWitness)
        
        // vkeyWitnessesをwitnessSetに再設定
        witnessSet.set_vkeys(vkeyWitnesses)
        
        policyWitnessHex = bytesToHex(witnessSet.to_bytes())
        
        console.log('Policy witness created', {
          vkeysCount: vkeyWitnesses.len(),
          nativeScriptsCount: witnessSet.native_scripts()?.len?.() ?? 0,
        })
      } catch (error: any) {
        console.warn('ポリシー署名�E追加に失敗しました:', error)
      }
    }
    
    // 17. CBORエンコーチE
    const cborHex = bytesToHex(tx.to_bytes())
 
    return {
      transactionBody: txBody,
      transaction: tx,
      cborHex,
      policyWitnessHex,
    }
    
  } catch (error: any) {
    throw new Error(`トランザクション構築に失敗しました: ${error.message || error}`)
  }
}

/**
 * トランザクションに署吁E
 */
export async function signTransaction(
  wallet: any,
  transaction: any, // CSL.Transaction
  policyWitnessHex?: string
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('signTransactionはブラウザ環境でのみ使用可能です')
  }

  try {
    const txBytes = transaction.to_bytes()
    const txHex = bytesToHex(txBytes)

    console.log('signTransaction input debug', {
      policyWitnessHexLength: policyWitnessHex?.length ?? 0,
    })

    const walletWitnessHex = await wallet.signTx(txHex, true)
    const walletWitnesses = CSL.TransactionWitnessSet.from_bytes(hexToBytes(walletWitnessHex))

    const baseWitness = transaction.witness_set()

    let policyWitness: any | undefined
    if (policyWitnessHex) {
      try {
        policyWitness = CSL.TransactionWitnessSet.from_bytes(hexToBytes(policyWitnessHex))
        console.log('Policy witness decoded', {
          vkeys: policyWitness.vkeys()?.len?.() ?? 0,
          nativeScripts: policyWitness.native_scripts()?.len?.() ?? 0,
        })
      } catch (error) {
        console.warn('policyWitnessHexのチE��ードに失敗しました:', error)
      }
    } else {
      console.warn('policyWitnessHexが提供されませんでした')
    }

    console.log('signTransaction witness counts (before merge)', {
      baseVkeys: baseWitness.vkeys()?.len?.() ?? 0,
      baseNativeScripts: baseWitness.native_scripts()?.len?.() ?? 0,
      walletVkeys: walletWitnesses.vkeys()?.len?.() ?? 0,
      walletNativeScripts: walletWitnesses.native_scripts()?.len?.() ?? 0,
    })

    const mergedWitnesses = CSL.TransactionWitnessSet.new()

    mergeWitnessSet(mergedWitnesses, baseWitness)
    mergeWitnessSet(mergedWitnesses, policyWitness)
    mergeWitnessSet(mergedWitnesses, walletWitnesses)

    console.log('signTransaction witness counts (after merge)', {
      mergedNativeScripts: mergedWitnesses.native_scripts()?.len?.() ?? 0,
      mergedVkeys: mergedWitnesses.vkeys()?.len?.() ?? 0,
    })

    const finalTx = CSL.Transaction.new(
      transaction.body(),
      mergedWitnesses,
      transaction.auxiliary_data()
    )

    return bytesToHex(finalTx.to_bytes())
  } catch (error: any) {
    throw new Error(`トランザクション署名に失敗しました: ${error.message || error}`)
  }
}

function mergeWitnessSet(target: any, source: any) {
  if (!source) return

  mergeCollection(
    source.vkeys?.(),
    () => target.vkeys?.(),
    () => CSL.Vkeywitnesses.new(),
    (collection) => target.set_vkeys(collection)
  )

  mergeCollection(
    source.native_scripts?.(),
    () => target.native_scripts?.(),
    () => CSL.NativeScripts.new(),
    (collection) => target.set_native_scripts(collection)
  )

  mergeCollection(
    source.bootstraps?.(),
    () => target.bootstraps?.(),
    () => CSL.BootstrapWitnesses.new(),
    (collection) => target.set_bootstraps(collection)
  )
}

function mergeCollection(
  sourceCollection: any,
  getTargetCollection: () => any,
  createCollection: () => any,
  setTargetCollection: (collection: any) => void
) {
  if (!sourceCollection || typeof sourceCollection.len !== 'function' || sourceCollection.len() === 0) {
    return
  }

  let targetCollection = getTargetCollection()
  if (!targetCollection) {
    targetCollection = createCollection()
    setTargetCollection(targetCollection)
  }

  const sourceLen = sourceCollection.len()
  for (let i = 0; i < sourceLen; i++) {
    const item = sourceCollection.get(i)
    targetCollection.add(item)
  }
  
  // 追加後にコレクションを再設定
  setTargetCollection(targetCollection)
  
  console.log('mergeCollection debug', {
    sourceLen,
    targetLen: targetCollection.len(),
    addedItems: sourceLen,
  })
}

/**
 * トランザクションを送信
 */
export async function submitTransaction(
  wallet: any,
  signedTxHex: string
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('submitTransactionはブラウザ環境でのみ使用可能です')
  }
  
  try {
    const txHash = await wallet.submitTx(signedTxHex)
    return txHash
  } catch (error: any) {
    console.error('submitTxエラー詳細:', error)
    throw new Error(`トランザクション送信に失敗しました: ${error.message || error}`)
  }
}
