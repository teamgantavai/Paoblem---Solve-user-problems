'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestDBPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [insertedKeys, setInsertedKeys] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        // 1. Get a user_id from profiles
        const { data: profs, error: pe } = await supabase
          .from('profiles')
          .select('id, username')
          .limit(5);

        if (pe) {
          setError(pe);
          return;
        }
        setProfiles(profs);

        if (profs && profs.length > 0) {
          const userId = profs[0].id;
          // 2. Insert a temporary test notification
          const { data: newNotif, error: ie } = await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'system',
              title: 'Temp Test Notification',
              body: 'Temporary test body'
            })
            .select()
            .single();

          if (ie) {
            setError(ie);
          } else {
            setData(newNotif);
            setInsertedKeys(Object.keys(newNotif));
            
            // 3. Clean up and delete it
            await supabase
              .from('notifications')
              .delete()
              .eq('id', newNotif.id);
          }
        } else {
          setError('No profiles found in the database to run the test.');
        }
      } catch (ex: any) {
        setError(ex.message || ex);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: '2rem', color: 'black', background: 'white' }}>
      <h1>DB Column Test</h1>
      {error && <pre style={{ color: 'red' }}>Error: {JSON.stringify(error, null, 2)}</pre>}
      {profiles && (
        <div>
          <h3>Profiles:</h3>
          <pre>{JSON.stringify(profiles, null, 2)}</pre>
        </div>
      )}
      {data && (
        <div>
          <h2>Columns found in notifications table:</h2>
          <pre>{JSON.stringify(insertedKeys, null, 2)}</pre>
          <h3>Full Inserted Row:</h3>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
