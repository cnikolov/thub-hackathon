import { Hono } from 'hono';
import { FishjamClient } from '@fishjam-cloud/js-server-sdk';

export const roomsController = new Hono();

let fishjamClient: FishjamClient | null = null;

const getFishjamClient = () => {
  if (!fishjamClient) {
    const fishjamId = process.env.FISHJAM_ID;
    const managementToken = process.env.FISHJAM_MANAGEMENT_TOKEN;

    if (!fishjamId || !managementToken) {
      throw new Error('FISHJAM_ID or FISHJAM_MANAGEMENT_TOKEN environment variables are not set');
    }

    fishjamClient = new FishjamClient({
      fishjamId,
      managementToken,
    });
  }
  return fishjamClient;
};

roomsController.post('/join-room', async (c) => {
  try {
    const body = await c.req.json();
    const { roomName, peerName } = body;

    const client = getFishjamClient();

    // Create room
    // Note: In a real app, you might want to check if a room with `roomName` already exists
    // and store the room ID in a database. For this example we just create a new room.
    const room = await client.createRoom();

    // Add peer
    const { peer, peerToken } = await client.createPeer(room.id, {
      metadata: { name: peerName },
    });

    return c.json({
      roomId: room.id,
      peerToken,
    });
  } catch (error: any) {
    console.error('Error joining room:', error);
    return c.json({ error: error.message }, 500);
  }
});
