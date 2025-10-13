create or replace function public.on_submission_approved()
returns trigger as $$
declare
  new_novel_id uuid;
  slug text;
begin
  if NEW.status = 'approved' and OLD.status is distinct from 'approved' then
    slug := regexp_replace(lower(NEW.title), '[^a-z0-9]+', '-', 'g');
    insert into public.novels (slug, title, author_id, cover_url, synopsis, tags, status, rating)
    values (slug, NEW.title, NEW.author_id, NEW.cover_url, NEW.synopsis, NEW.tags, 'Ongoing', 0)
    returning id into new_novel_id;

    insert into public.chapters (novel_id, number, title, content)
    values (new_novel_id, 1, 'Bab 1', coalesce(NEW.content, ''));

    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_submission_approved on public.submissions;
create trigger trg_submission_approved
after update on public.submissions
for each row execute function public.on_submission_approved();
