-- Allow current UI game titles + legacy values already stored in DB.
-- Error without this: 23514 collection_base_game_check

alter table public.collection_base
  drop constraint if exists collection_base_game_check;

alter table public.collection_base
  add constraint collection_base_game_check check (
    game_title is null
    or game_title in (
      'Pokemon JP',
      'YGO OCG',
      'BS',
      'Pokémon TCG JP',
      'Pokémon TCG EN',
      'Pokémon TCG TC',
      'Yu-Gi-Oh! JP OCG',
      'Yu-Gi-Oh! EN TCG',
      'Battle Spirits'
    )
  );
