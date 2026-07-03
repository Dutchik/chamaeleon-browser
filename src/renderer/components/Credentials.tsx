import React, { useEffect, useState } from 'react';
import type { CredentialMeta } from '../../shared/types';

interface Props {
  onClose(): void;
  onChange(): void; // 保存/削除後に一覧再取得を促す
}

/// 認証情報マネージャ（端末内・暗号化保存 ＋ セキュリティ警告）
export function Credentials(p: Props) {
  const [items, setItems] = useState<CredentialMeta[]>([]);
  const [encAvailable, setEncAvailable] = useState(true);
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  const reload = () => window.chamaeleon.credsList().then(setItems);
  useEffect(() => {
    reload();
    window.chamaeleon.credsEncryptionAvailable().then(setEncAvailable);
  }, []);

  const save = async () => {
    if (!domain || !username) return;
    await window.chamaeleon.credsSave(domain.trim(), username.trim(), password);
    setDomain(''); setUsername(''); setPassword('');
    reload(); p.onChange();
  };

  return (
    <div className="reports-overlay" onClick={p.onClose}>
      <div className="reports" onClick={(e) => e.stopPropagation()}>
        <div className="reports-head">
          <strong>🔐 認証情報（ユーザー名・パスワード）</strong>
          <span style={{ flex: 1 }} />
          <button onClick={p.onClose}>閉じる</button>
        </div>
        <div className="reports-body">
          <div className="warn-box">
            ⚠ <b>セキュリティに関する警告</b><br />
            入力したユーザー名・パスワードは<b>この端末内のみ</b>に、
            {encAvailable ? 'OSの暗号化ストレージ（Keychain / Credential Vault 等）で暗号化して' : '（この環境では暗号化が使えないため base64 で）'}
            保存されます。外部サーバーには一切送信されません。
            共有・公共PCでは保存しないでください。銀行・証券・決済サイトでの自動入力は特に慎重に扱ってください。
          </div>

          <div className="form" style={{ marginBottom: 16 }}>
            <label>サイト（ドメイン）
              <input placeholder="例: example.com" value={domain} spellCheck={false}
                     onChange={(e) => setDomain(e.target.value)} />
            </label>
            <label>ユーザー名
              <input placeholder="ユーザー名 / メールアドレス" value={username} spellCheck={false}
                     onChange={(e) => setUsername(e.target.value)} />
            </label>
            <label>パスワード
              <div className="patchhead">
                <input type={show ? 'text' : 'password'} value={password}
                       onChange={(e) => setPassword(e.target.value)} />
                <button onClick={() => setShow(!show)}>{show ? '隠す' : '表示'}</button>
              </div>
            </label>
            <button onClick={save} disabled={!domain || !username}>保存</button>
          </div>

          {items.map((c) => (
            <div key={c.id} className="patchrow">
              <div className="patchhead">
                <div style={{ flex: 1 }}>
                  <div className="lib-title">{c.domain}</div>
                  <div className="lib-url">{c.username}</div>
                </div>
                <button className="danger" onClick={async () => { await window.chamaeleon.credsDelete(c.id); reload(); p.onChange(); }}>🗑</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="sp-hint">保存された認証情報はありません。</div>}
        </div>
      </div>
    </div>
  );
}
