# CNFTミントWebアプリケーション

Cardano NFT（CNFT）をミントするWebアプリケーションです。

## 機能

- Cardanoウォレット接続（Nami、Eternl、Flint、Yoroi等）
- NFTミント機能
- 画像アップロード
- メタデータ設定
- ローカルIPFSサーバーへのアップロード機能
- アップロード進捗表示

## セットアップ

```bash
npm install
```

### Kubo RPCサーバーのセットアップ

ローカルKubo RPCサーバーを使用する場合は、Kubo（IPFS）サーバーを起動してください。

1. Kuboをインストール（まだインストールしていない場合）
   ```bash
   # macOS (Homebrew)
   brew install ipfs
   
   # Linux (snap)
   snap install ipfs
   
   # または公式サイトから: https://ipfs.io/docs/install/
   # または https://github.com/ipfs/kubo/releases からダウンロード
   ```

2. Kuboを初期化（初回のみ）
   ```bash
   ipfs init
   ```

3. Kubo RPCサーバーを起動
   ```bash
   ipfs daemon
   ```
   
   デフォルトで以下のポートで起動します：
   - APIサーバー: `http://localhost:5001` (Kubo RPC API)
   - ゲートウェイ: `http://localhost:8080`
   - スワーム: `4001`

4. 環境変数（オプション）
   
   `.env.local` ファイルを作成して、Kubo RPCサーバーのURLを設定できます：
   ```
   IPFS_URL=http://localhost:5001
   NEXT_PUBLIC_IPFS_GATEWAY=https://ipfs.io/ipfs/
   ```
   
   サーバーサイドで使用される環境変数:
   - `IPFS_URL`: サーバーサイドでのKubo RPCサーバーのURL（デフォルト: `http://localhost:5001`）
   
   クライアントサイドで使用される環境変数:
   - `NEXT_PUBLIC_IPFS_URL`: クライアントから送信されるデフォルトURL
   
   **注意**: 
   - Kubo RPC APIはサーバーサイドで呼び出されます（クライアントから直接呼び出しません）
   - デフォルトでローカルホストのみを許可しています
   - リモートサーバーを使用する場合は、サーバー環境変数で設定してください

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 必要な環境

- Node.js 18以上
- Cardanoウォレット拡張機能（Nami、Eternl、Flint、Yoroiなど）
- IPFSサーバー（ローカルIPFSを使用する場合）

## Kubo RPCアップロード機能

このアプリケーションは、NFTの画像とメタデータをローカルKubo RPCサーバーにアップロードする機能を提供します。

### アーキテクチャ

**サーバーサイド実装**: Kubo RPCの呼び出しはすべてサーバーサイド（Next.js APIルート）で実行されます。これにより、セキュリティが向上し、CORSの問題を回避できます。

- **APIルート**:
  - `/api/ipfs/upload` - ファイルアップロード
  - `/api/ipfs/upload-metadata` - メタデータアップロード
  - `/api/ipfs/test-connection` - 接続テスト

### 使用方法

1. Kubo RPCサーバーを起動（上記のセットアップを参照）
2. アプリケーションの「Kubo RPCサーバーURL」フィールドにサーバーのURLを入力
   - デフォルト: `http://localhost:5001`
   - このURLはサーバーサイドAPIに渡されます
3. 「接続テスト」ボタンで接続を確認（オプション）
4. NFTをミントすると、クライアントからAPIルート経由でサーバーサイドのKubo RPCが呼び出され、自動的に画像とメタデータがIPFSにアップロードされます
5. アップロード後、IPFS CID（Content Identifier）が表示されます

### Kubo RPCの機能

- **サーバーサイド実行**: すべてのKubo RPC呼び出しはサーバーサイドで実行されます
- **自動ピン**: アップロードしたファイルは自動的にピンされます（削除されません）
- **エラーハンドリング**: 接続エラーやアップロード失敗時に適切なエラーメッセージを表示
- **接続テスト**: 接続ボタンでKubo RPCサーバーの状態を確認
- **バージョン表示**: 接続成功時にKuboのバージョンを表示

### IPFS CIDについて

- **画像IPFS CID**: アップロードされた画像のハッシュ値
- **メタデータIPFS CID**: アップロードされたメタデータのハッシュ値

これらのCIDは、NFTメタデータに含まれ、IPFSネットワーク上で画像やメタデータを参照するために使用されます。

## 注意事項

- テストネットまたはメインネットでテストする際は、十分なADAをウォレットに用意してください
- NFTミントにはトランザクション手数料がかかります
- IPFSサーバーが起動していない場合、アップロードは失敗します
- ローカルIPFSサーバーを使用する場合、ファイルはローカルノードにのみ保存されます
- 他のノードからもアクセス可能にするには、IPFSネットワークにピンを追加する必要があります

