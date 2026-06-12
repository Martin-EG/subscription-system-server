import 'dotenv/config';
import { createClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  })
  .parse(process.env);

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const demoUsers = [
  {
    name: 'John Doe',
    email: 'admin.john@subsriptive.com',
    password: 'Demo123',
    role: 'ADMIN',
  },
  {
    name: 'Jane Doe',
    email: 'jane.doe@subsdemo.com',
    password: 'Demo123',
    role: 'USER',
  },
] as const;

async function findAuthUserByEmail(email: string): Promise<User | null> {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw error;
    }

    const existingUser = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );

    if (existingUser) {
      return existingUser;
    }

    if (data.users.length < 1000) {
      return null;
    }

    page += 1;
  }
}

async function upsertDemoUser(demoUser: (typeof demoUsers)[number]): Promise<void> {
  const existingUser = await findAuthUserByEmail(demoUser.email);
  let authUser: User;

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email: demoUser.email,
      password: demoUser.password,
      email_confirm: true,
      user_metadata: {
        ...existingUser.user_metadata,
        name: demoUser.name,
      },
      app_metadata: {
        ...existingUser.app_metadata,
        app_role: demoUser.role,
      },
    });

    if (error) {
      throw error;
    }

    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: demoUser.email,
      password: demoUser.password,
      email_confirm: true,
      user_metadata: {
        name: demoUser.name,
      },
      app_metadata: {
        app_role: demoUser.role,
      },
    });

    if (error) {
      throw error;
    }

    authUser = data.user;
  }

  const { error: profileError } = await supabase.from('users').upsert(
    {
      id: authUser.id,
      name: demoUser.name,
      email: demoUser.email,
      role: demoUser.role,
    },
    {
      onConflict: 'id',
    },
  );

  if (profileError) {
    throw profileError;
  }

  console.info(`Seeded ${demoUser.role}: ${demoUser.email}`);
}

async function main(): Promise<void> {
  for (const demoUser of demoUsers) {
    await upsertDemoUser(demoUser);
  }
}

main().catch((error: unknown) => {
  console.error('Failed to seed Supabase users:', error);
  process.exitCode = 1;
});
