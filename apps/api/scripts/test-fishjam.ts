import { FishjamClient } from '@fishjam-cloud/js-server-sdk';

const fishjamId = process.env.FISHJAM_ID ?? 'f2d20fd65b4f491e8d7008969747806b';
const managementToken = process.env.FISHJAM_MANAGEMENT_TOKEN ?? 'e9d565da5ed9ec68d6186c2b8f632a235f6e87d04dc1f994a20d9db77f6927d1';

console.log('Testing Fishjam using the SDK (same as agent.ts)...\n');

const client = new FishjamClient({ fishjamId, managementToken });

try {
  console.log('[1] createRoom({ roomType: "full_feature" })...');
  const room = await client.createRoom({ roomType: 'full_feature' as any });
  console.log(`    OK — room ${room.id}\n`);

  try {
    console.log('[2] createPeer(room.id, { metadata: { name, role } })...');
    const { peerToken } = await client.createPeer(room.id, {
      metadata: { name: 'Test User', role: 'candidate' },
    });
    console.log(`    OK — token ${peerToken.slice(0, 20)}...\n`);
  } catch (e: any) {
    console.error(`    FAILED: ${e.message}`);
    if (e.statusCode) console.error(`    statusCode: ${e.statusCode}`);
    if (e.details) console.error(`    details: ${e.details}`);
    console.log();
  }

  try {
    console.log('[3] createAgent(room.id, { subscribeMode, output })...');
    const agentResult = await client.createAgent(
      room.id,
      { subscribeMode: 'auto' as any, output: { audioFormat: 'pcm16' as any, audioSampleRate: 16000 as any } },
      { onError: (e) => console.error('    agent onError:', e), onClose: (_c, r) => console.log('    agent onClose:', r) },
    );
    console.log(`    OK — agent peer ${agentResult.peer.id}\n`);
    agentResult.agent.disconnect();
  } catch (e: any) {
    console.error(`    FAILED: ${e.message}`);
    if (e.statusCode) console.error(`    statusCode: ${e.statusCode}`);
    if (e.details) console.error(`    details: ${e.details}`);
    console.log();
  }

  await client.deleteRoom(room.id);
  console.log('[cleanup] Room deleted.');
} catch (e: any) {
  console.error(`FAILED at room level: ${e.message}`);
  if (e.statusCode) console.error(`statusCode: ${e.statusCode}`);
  if (e.details) console.error(`details: ${e.details}`);
}

process.exit(0);
