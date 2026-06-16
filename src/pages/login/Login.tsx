import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextInput, TagsInput, Button, Paper, Title, Container, Group, Stack } from '@mantine/core';
import { PMIcon } from '@/components/icons/PMIcon';
import { AuthService } from '@/lib/auth';

export function Login() {
  const [username, setUsername] = useState('');
  const [attrs, setAttrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  AuthService.logout();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() && attrs.length === 0) {
      return;
    }

    setLoading(true);
    AuthService.login(username.trim(), attrs);
    navigate('/');
    setLoading(false);
  };

  return (
    <Container size={500} my={40}>
      <Stack align="center" gap="xl" mb="xl">
        <PMIcon style={{ width: '150px' }} />
        <Title order={1} ta="center" fw={900}>
          Policy Machine Admin Tool
        </Title>
      </Stack>

      <Paper withBorder shadow="md" p={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Username"
            placeholder="Your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <TagsInput
            label="User Attributes"
            placeholder="Add an attribute and press Enter"
            value={attrs}
            onChange={(values) => setAttrs(values.map((v) => v.replace(/^["']|["']$/g, '')))}

            mt="sm"
          />

          <Group justify="flex-end" mt="xl">
            <Button type="submit" loading={loading} disabled={!username.trim() && attrs.length === 0}>
              Sign in
            </Button>
          </Group>
        </form>
      </Paper>

      <Group justify="center" mt="md">
        <Button component={Link} to="/pml" variant="subtle" size="xs">
          Open PML Editor
        </Button>
      </Group>
    </Container>
  );
} 