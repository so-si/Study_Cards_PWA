# 編集済み論点集の読み物

既存のクイズと並行して使う読み物。カード全文・編集済み原稿・接続キーはこの公開リポジトリへ置かない。

## 読み込み

「編集済み論点集を読む」から、認証済GASのgetRonshuten、又は端末上の原稿JSONを読み込む。通常はverifiedだけを表示する。「未確認の原稿も表示する」を選ぶと確認事項付きで草稿を読める。

保存キーはstudyCardsRonshutenV1。既存クイズの保存データと未送信回答キューは変更しない。関連論点・前後移動・検索・出典表示に対応。「この論点のカードで復習」は元カードIDで既存クイズを開始する。

## GAS

gas/Code.gsにgetRonshutenを追加した。非公開の原稿JSONファイルをDriveへ保存し、スクリプトプロパティRONSHUTEN_FILE_IDを設定する。API_TOKENは必須。ファイルへの公開権限は付けない。通常のレスポンスにはverifiedのみを含め、includeDrafts=trueを認証済みで要求した場合だけdraft/reviewedも返す。監査用sourceCardsは配信しない。

## 検証

DOMテストはjsdom 26.1.0、実ブラウザテストはPlaywrightを使う。テスト原稿は安全なローカルパスを引数に渡す。

```bash
node tests/reader-dom.cjs /secure/ronshuten_audit.json
node tests/reader.cjs /secure/ronshuten_audit.json
```

CHROMIUM_PATHでブラウザの実行ファイルを指定できる。ブラウザテストはリポジトリの親をHTTPの8765番で提供する前提。画像はテスト実行ディレクトリの親のworkへ出力する。DOMテストはレイアウトやサービスワーカーの動作を保証しない。

今回、実ブラウザは実行権限とURLポリシーの制限で未検証。iPhone実表示・本番通信・サービスワーカーを通したオフライン受入が残る。
