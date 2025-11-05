import { NextRequest, NextResponse } from 'next/server'
import { uploadToKuboRPC } from '@/lib/ipfs-server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { metadata, options } = body

    if (!metadata) {
      return NextResponse.json(
        { error: 'メタデータが提供されていません' },
        { status: 400 }
      )
    }

    // IPFS URLは環境変数からのみ取得（ユーザー入力なし）
    const kuboUrl = process.env.IPFS_URL || 'http://localhost:5001'

    // メタデータをJSON文字列に変換
    const jsonString = JSON.stringify(metadata, null, 2)
    const buffer = Buffer.from(jsonString, 'utf-8')

    // Kubo RPCでアップロード（デフォルトでピン）
    const cid = await uploadToKuboRPC(buffer, 'metadata.json', kuboUrl, {
      pin: options?.pin !== false,
      wrapWithDirectory: options?.wrapWithDirectory || false,
    })

    return NextResponse.json({ cid })
  } catch (error: any) {
    console.error('IPFSメタデータアップロードAPIエラー:', error)
    return NextResponse.json(
      { error: error.message || 'IPFSメタデータアップロードに失敗しました' },
      { status: 500 }
    )
  }
}

