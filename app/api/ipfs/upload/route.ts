import { NextRequest, NextResponse } from 'next/server'
import { uploadToKuboRPC } from '@/lib/ipfs-server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが提供されていません' },
        { status: 400 }
      )
    }

    // IPFS URLは環境変数からのみ取得（ユーザー入力なし）
    const ipfsUrl = process.env.IPFS_URL || 'http://localhost:5001'
    
    const pin = formData.get('pin') !== 'false'
    const wrapWithDirectory = formData.get('wrapWithDirectory') === 'true'

    // FileをBufferに変換
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Kubo RPCでアップロード
    const cid = await uploadToKuboRPC(buffer, file.name, ipfsUrl, {
      pin,
      wrapWithDirectory,
    })

    return NextResponse.json({ cid })
  } catch (error: any) {
    console.error('IPFSアップロードAPIエラー:', error)
    return NextResponse.json(
      { error: error.message || 'IPFSアップロードに失敗しました' },
      { status: 500 }
    )
  }
}

