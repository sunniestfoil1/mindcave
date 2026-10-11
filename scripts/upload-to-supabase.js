import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://ddwdgwaliywymcatdekg.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkd2Rnd2FsaXl3eW1jYXRkZWtnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM5NTIyMCwiZXhwIjoyMTA2OTcxMjIwfQ.o7rNNQCtDluh36JbiPCdBINUgIWZUronrkzejiUAvZ8';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('1. Checking existing Supabase Storage buckets with service role...');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.error('Error listing buckets:', bErr);
  } else {
    console.log('Existing buckets:', buckets.map(b => b.name));
  }

  const bucketName = 'game-assets';
  let bucket = buckets && buckets.find(b => b.name === bucketName);

  if (!bucket) {
    console.log(`2. Creating public bucket '${bucketName}'...`);
    const { data: cData, error: cErr } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: null // No size limit restrictions
    });
    if (cErr) {
      console.error('Create bucket error:', cErr);
    } else {
      console.log(`Bucket '${bucketName}' created successfully:`, cData);
    }
  } else {
    console.log(`Bucket '${bucketName}' already exists (public: ${bucket.public}).`);
    if (!bucket.public) {
      console.log(`Updating bucket '${bucketName}' to public...`);
      await supabase.storage.updateBucket(bucketName, { public: true });
    }
  }

  const filesToUpload = [
    { localPath: 'Old_Default_1.8.9.zip', remoteName: 'Old_Default_1.8.9.zip' },
    { localPath: 'CEU.zip', remoteName: 'CEU.zip' },
    { localPath: 'minecraft-assets-1.8.9.zip', remoteName: 'minecraft-assets-1.8.9.zip' },
  ];

  for (const item of filesToUpload) {
    if (!fs.existsSync(item.localPath)) {
      console.warn(`File does not exist locally: ${item.localPath}`);
      continue;
    }

    const stats = fs.statSync(item.localPath);
    console.log(`\nUploading ${item.localPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB) to '${bucketName}'...`);

    const fileBuffer = fs.readFileSync(item.localPath);
    const { data: uData, error: uErr } = await supabase.storage
      .from(bucketName)
      .upload(item.remoteName, fileBuffer, {
        cacheControl: '31536000',
        upsert: true,
        contentType: 'application/zip',
      });

    if (uErr) {
      console.error(`❌ Failed to upload ${item.localPath}:`, uErr);
    } else {
      console.log(`✅ Successfully uploaded ${item.remoteName}!`);
      const { data: pUrl } = supabase.storage.from(bucketName).getPublicUrl(item.remoteName);
      console.log(`🔗 Public URL: ${pUrl.publicUrl}`);
    }
  }

  console.log('\n--- Final Public URLs ---');
  for (const item of filesToUpload) {
    const { data: pUrl } = supabase.storage.from(bucketName).getPublicUrl(item.remoteName);
    console.log(`${item.remoteName}: ${pUrl.publicUrl}`);
  }
}

main().catch(console.error);
