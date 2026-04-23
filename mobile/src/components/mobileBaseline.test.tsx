import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer from 'react-test-renderer';

import { AccountPanel } from './AccountPanel';
import { FileBrowser } from './FileBrowser';
import { HomeDashboard } from './HomeDashboard';
import { LoginForm } from './LoginForm';
import { PricingCenter } from './PricingCenter';
import { RegisterForm } from './RegisterForm';
import { ShareCenter } from './ShareCenter';
import type {
  QuickShareFileInfo,
  QuickShareNotification,
  QuickSharePaymentOrder,
  QuickSharePaymentOptions,
  QuickSharePlan,
  QuickShareShareLink,
  QuickShareTransferDevice,
  QuickShareTransferPublicShare,
  QuickShareTransferTask,
  QuickShareUser,
} from '../types/quickshare';

type RendererLike = {
  root: {
    findAllByType: (value: unknown) => Array<{ props: { children?: unknown; placeholder?: string } }>;
  };
};

function collectText(node: RendererLike) {
  return node.root.findAllByType(Text).map((entry: { props: { children?: unknown } }) => {
    const children = entry.props.children;
    if (Array.isArray(children)) {
      return children.join('');
    }
    return String(children ?? '');
  }).join('\n');
}

function renderWithAct(element: React.ReactElement) {
  let tree!: RendererLike;
  TestRenderer.act(() => {
    tree = TestRenderer.create(element) as unknown as RendererLike;
  });
  return tree;
}

const noop = () => {};

describe('mobile baseline components', () => {
  test('guest home dashboard exposes share and pickup baseline', () => {
    const tree = renderWithAct(
      <HomeDashboard
        deviceTransferError={null}
        deviceTransferLoading={false}
        devices={[]}
        directSessionError={null}
        directSessionLoading={false}
        directShareError={null}
        directShareLoading={false}
        incomingTasks={[]}
        latestDirectControlMessage={null}
        latestDirectSession={null}
        latestDirectTransport={null}
        latestIncomingDirectFile={null}
        latestShare={null}
        latestTransferPickup={null}
        onCreateDirectShare={noop}
        onDeleteTransferTask={noop}
        onDownloadIncomingTransfer={noop}
        onGoToAccount={noop}
        onGoToFiles={noop}
        onGoToGoogleLogin={noop}
        onGoToPricing={noop}
        onGoToShare={noop}
        onPrepareDirectSession={noop}
        onSaveIncomingDirectFile={noop}
        onSaveIncomingTransfer={noop}
        onSendToDevice={noop}
        outgoingTasks={[]}
        profile={null}
        syncLoading={false}
        transferTaskActionError={null}
        transferTaskActionLoadingId={null}
      />
    );

    const text = collectText(tree);
    expect(text).toContain('Hi, Guest');
    expect(text).toContain('Direct Share');
    expect(text).toContain('Share Center');
    expect(text).toContain('Google Sign-in');
    expect(text).toContain('Create pickup from Home');
    expect(text).toContain('Guest mode');
  });

  test('signed-in home dashboard exposes storage, devices, and tasks', () => {
    const profile: QuickShareUser = {
      id: 1,
      username: 'admin',
      nickname: 'QuickShare Admin',
      storageUsed: 128,
      storageLimit: 1024,
      downloadUsed: 1,
      downloadLimit: 10,
    };
    const devices: QuickShareTransferDevice[] = [
      { deviceId: 'device-a', deviceName: 'Desktop', current: true, online: true },
      { deviceId: 'device-b', deviceName: 'Laptop', current: false, online: true },
    ];
    const incomingTasks: QuickShareTransferTask[] = [
      { id: 11, fileName: 'incoming.txt', peerLabel: 'Laptop', attempts: [{ transferMode: 'relay', transferId: '22' }] },
    ];
    const outgoingTasks: QuickShareTransferTask[] = [
      { id: 12, fileName: 'outgoing.txt', peerLabel: 'Desktop' },
    ];

    const tree = renderWithAct(
      <HomeDashboard
        deviceTransferError={null}
        deviceTransferLoading={false}
        devices={devices}
        directSessionError={null}
        directSessionLoading={false}
        directShareError={null}
        directShareLoading={false}
        incomingTasks={incomingTasks}
        latestDirectControlMessage={null}
        latestDirectSession={null}
        latestDirectTransport={null}
        latestIncomingDirectFile={null}
        latestShare={null}
        latestTransferPickup={null}
        onCreateDirectShare={noop}
        onDeleteTransferTask={noop}
        onDownloadIncomingTransfer={noop}
        onGoToAccount={noop}
        onGoToFiles={noop}
        onGoToGoogleLogin={noop}
        onGoToPricing={noop}
        onGoToShare={noop}
        onPrepareDirectSession={noop}
        onSaveIncomingDirectFile={noop}
        onSaveIncomingTransfer={noop}
        onSendToDevice={noop}
        outgoingTasks={outgoingTasks}
        profile={profile}
        syncLoading={false}
        transferTaskActionError={null}
        transferTaskActionLoadingId={null}
      />
    );

    const text = collectText(tree);
    expect(text).toContain('Hi, QuickShare Admin');
    expect(text).toContain('Storage');
    expect(text).toContain('Connected devices');
    expect(text).toContain('Laptop');
    expect(text).toContain('Recent transfer tasks');
    expect(text).toContain('incoming.txt');
    expect(text).toContain('Outgoing transfers');
    expect(text).toContain('outgoing.txt');
  });

  test('login and register forms expose auth baseline controls', () => {
    const loginTree = renderWithAct(
      <LoginForm
        error={null}
        googleEnabled
        googleLoading={false}
        loading={false}
        onGoogleSubmit={noop}
        onPasswordChange={noop}
        onSubmit={noop}
        onUsernameChange={noop}
        password=""
        username=""
      />
    );
    const registerTree = renderWithAct(
      <RegisterForm
        email=""
        emailVerificationEnabled
        error={null}
        loading={false}
        nickname=""
        onEmailChange={noop}
        onNicknameChange={noop}
        onPasswordChange={noop}
        onSendCode={noop}
        onSubmit={noop}
        onUsernameChange={noop}
        onVerificationCodeChange={noop}
        password=""
        sendCodeLoading={false}
        username=""
        verificationCode=""
      />
    );

    expect(collectText(loginTree)).toContain('Continue with Google');
    expect(collectText(loginTree)).toContain('Sign in');
    const registerText = collectText(registerTree);
    expect(registerText).toContain('Register for QuickShare');
    expect(registerText).toContain('Send code');
    const verificationInput = registerTree.root.findAllByType(TextInput).find((input: { props: { placeholder?: string } }) => input.props.placeholder === 'Verification code');
    expect(verificationInput).toBeTruthy();
  });

  test('file, share, pricing, and account components expose current baseline actions', () => {
    const profile: QuickShareUser = {
      id: 1,
      username: 'admin',
      nickname: 'Admin',
      email: 'admin@example.com',
      storageUsed: 256,
      storageLimit: 2048,
      downloadUsed: 2,
      downloadLimit: 20,
      vipExpireTime: '2026-12-31',
      role: 'ADMIN',
    };
    const files: QuickShareFileInfo[] = [
      { id: 1, originalName: 'report.pdf', fileSize: 512, fileType: 'pdf', isFolder: 0 },
      { id: 2, name: 'Archive', isFolder: 1, fileCount: 3 },
    ];
    const latestShare: QuickShareShareLink = { shareCode: 'SC123', extractCode: 'ABCD', fileName: 'report.pdf' };
    const pickup: QuickShareTransferPublicShare = { id: 9, shareToken: 'pickup-9', fileName: 'hello.txt', ready: true, status: 'ready', pickupUrl: 'https://example.test/pickup-9' };
    const paymentOptions: QuickSharePaymentOptions = { providerId: 3, providerName: 'SmokePay', payTypes: ['alipay', 'wxpay'] };
    const plans: QuickSharePlan[] = [{ id: 8, name: 'Pro', description: 'Plan', type: 'storage', value: 2048, price: 9.9 }];
    const orders: QuickSharePaymentOrder[] = [{ id: 4, orderNo: 'ORD-1', planName: 'Pro', status: 'paid', payType: 'alipay', amount: 9.9, createTime: '2026-04-21' }];
    const notifications: QuickShareNotification[] = [{ id: 1, subject: 'Notice', body: 'Hello', createTime: '2026-04-21' }];

    const fileTree = renderWithAct(
      <FileBrowser
        actionDraftName=""
        actionMode={null}
        actionMoveTargetId="0"
        actionTargetLabel={null}
        allFolders={[]}
        createFolderName="Reports"
        currentFolderId={null}
        error={null}
        files={files}
        isLoggedIn
        loading={false}
        onCreateFolder={noop}
        onCreateFolderNameChange={noop}
        onDeleteItem={noop}
        onDownloadFile={noop}
        onFolderPress={noop}
        onMoveTargetChange={noop}
        onPathPress={noop}
        onPreviewFile={noop}
        onRefresh={noop}
        onRenameDraftChange={noop}
        onSelectMove={noop}
        onSelectRename={noop}
        onShareFile={noop}
        onSignOut={noop}
        onSubmitAction={noop}
        onUpload={noop}
        path={[{ id: null, label: 'Root' }]}
        profile={profile}
      />
    );
    const shareTree = renderWithAct(
      <ShareCenter
        createShareLoading={false}
        latestShare={latestShare}
        onLookupPublicShare={noop}
        onLookupTransferPickup={noop}
        onOpenLatestShareDownload={noop}
        onOpenLatestSharePreview={noop}
        onOpenPublicShareDownload={noop}
        onOpenPublicSharePreview={noop}
        onOpenTransferPickupDownload={noop}
        onOpenTransferPickupPreview={noop}
        onPublicShareCodeChange={noop}
        onPublicShareExtractCodeChange={noop}
        onSaveTransferPickup={noop}
        onTransferPickupTokenChange={noop}
        publicShareCode="SC123"
        publicShareError={null}
        publicShareExtractCode="ABCD"
        publicShareLoading={false}
        publicShareResult={latestShare}
        transferPickupError={null}
        transferPickupLoading={false}
        transferPickupResult={pickup}
        transferPickupToken="pickup-9"
      />
    );
    const pricingTree = renderWithAct(
      <PricingCenter
        error={null}
        loading={false}
        onCreateOrder={noop}
        onRefreshOrders={noop}
        onSelectOrder={noop}
        orders={orders}
        paymentMeta="Last checked just now"
        paymentOptions={paymentOptions}
        plans={plans}
        selectedOrder={orders[0]}
      />
    );
    const accountTree = renderWithAct(
      <AccountPanel
        apiBaseUrl="https://quickshare.example.test"
        globalNotifications={notifications}
        notificationError={null}
        notificationLoading={false}
        onSignOut={noop}
        personalNotifications={notifications}
        profile={profile}
      />
    );

    const fileText = collectText(fileTree);
    expect(fileText).toContain('My Netdisk');
    expect(fileText).toContain('Upload');
    expect(fileText).toContain('Preview');
    expect(fileText).toContain('Download');
    expect(fileText).toContain('Share');

    const shareText = collectText(shareTree);
    expect(shareText).toContain('Create share links');
    expect(shareText).toContain('Open public share');
    expect(shareText).toContain('Transfer pickup');
    expect(shareText).toContain('Save');

    const pricingText = collectText(pricingTree);
    expect(pricingText).toContain('Plans');
    expect(pricingText).toContain('Create payment order');
    expect(pricingText).toContain('My orders');
    expect(pricingText).toContain('Selected order');

    const accountText = collectText(accountTree);
    expect(accountText).toContain('Account');
    expect(accountText).toContain('Quota');
    expect(accountText).toContain('Notifications');
    expect(accountText).toContain('API base');
  });
});
