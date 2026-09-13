CREATE TABLE public.just_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'grocery',
  pack_qty numeric not null,
  pack_unit text not null default 'g',
  price numeric not null,
  keywords text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.just_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.just_products TO authenticated;
GRANT ALL ON public.just_products TO service_role;

ALTER TABLE public.just_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view Just catalog" ON public.just_products FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert catalog" ON public.just_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update catalog" ON public.just_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete catalog" ON public.just_products FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_just_products_updated_at BEFORE UPDATE ON public.just_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.just_products (name, category, pack_qty, pack_unit, price, keywords) VALUES
('Just Pure Sunflower Oil', 'edible oil', 1000, 'ml', 140, ARRAY['sunflower oil','fortune','sunflower','refined oil']),
('Just Soyabean Oil', 'edible oil', 1000, 'ml', 128, ARRAY['soyabean oil','soya oil','soyabean']),
('Just Whole Wheat Atta', 'staples', 5000, 'g', 235, ARRAY['atta','aashirvaad','wheat flour','chakki atta','gehu']),
('Just Iodized Salt', 'staples', 1000, 'g', 30, ARRAY['salt','tata salt','namak','iodized']),
('Just Sugar', 'staples', 1000, 'g', 45, ARRAY['sugar','cheeni','shakkar']),
('Just Toor Dal', 'pulses', 1000, 'g', 145, ARRAY['toor dal','arhar','tur dal']),
('Just Moong Dal', 'pulses', 1000, 'g', 128, ARRAY['moong dal','mung dal']),
('Just Chana Dal', 'pulses', 1000, 'g', 92, ARRAY['chana dal','bengal gram']),
('Just Basmati Rice', 'staples', 1000, 'g', 105, ARRAY['basmati','rice','chawal','india gate','daawat']),
('Just Sona Masoori Rice', 'staples', 5000, 'g', 320, ARRAY['sona masoori','rice']),
('Just Besan', 'staples', 500, 'g', 42, ARRAY['besan','gram flour']),
('Just Poha', 'staples', 500, 'g', 28, ARRAY['poha','flattened rice']),
('Just Rava Sooji', 'staples', 500, 'g', 26, ARRAY['rava','sooji','suji','semolina']),
('Just Turmeric Powder', 'spices', 200, 'g', 42, ARRAY['turmeric','haldi','everest','mdh']),
('Just Red Chilli Powder', 'spices', 200, 'g', 58, ARRAY['chilli powder','mirchi','lal mirch']),
('Just Coriander Powder', 'spices', 200, 'g', 40, ARRAY['coriander powder','dhania']),
('Just Garam Masala', 'spices', 100, 'g', 55, ARRAY['garam masala']),
('Just Mustard Seeds', 'spices', 200, 'g', 32, ARRAY['mustard','rai','sarson']),
('Just Cumin Seeds', 'spices', 100, 'g', 48, ARRAY['jeera','cumin']),
('Just Tea Leaves', 'beverages', 500, 'g', 215, ARRAY['tea','chai patti','red label','tata tea','taj mahal']),
('Just Instant Coffee', 'beverages', 50, 'g', 155, ARRAY['coffee','nescafe','bru']),
('Just Detergent Powder', 'home care', 1000, 'g', 92, ARRAY['detergent','surf','ariel','washing powder','nirma']),
('Just Dishwash Gel', 'home care', 750, 'ml', 105, ARRAY['dishwash','vim','pril','dish gel']),
('Just Floor Cleaner', 'home care', 1000, 'ml', 118, ARRAY['floor cleaner','lizol','phenyl']),
('Just Toilet Cleaner', 'home care', 500, 'ml', 68, ARRAY['toilet cleaner','harpic']),
('Just Hand Wash', 'personal care', 750, 'ml', 95, ARRAY['hand wash','handwash','lifebuoy','dettol']),
('Just Bath Soap', 'personal care', 400, 'g', 128, ARRAY['soap','bathing bar','lux','santoor','medimix']),
('Just Shampoo', 'personal care', 340, 'ml', 189, ARRAY['shampoo','clinic plus','head shoulders','dove']),
('Just Toothpaste', 'personal care', 200, 'g', 96, ARRAY['toothpaste','colgate','pepsodent','closeup']),
('Just Peanut Butter', 'packaged food', 500, 'g', 199, ARRAY['peanut butter','pintola','sundrop']),
('Just Tomato Ketchup', 'packaged food', 950, 'g', 118, ARRAY['ketchup','tomato sauce','kissan','maggi sauce']),
('Just Salted Biscuits', 'packaged food', 300, 'g', 48, ARRAY['biscuit','marie','parle','britannia','good day']),
('Just Roasted Almonds', 'dry fruits', 500, 'g', 449, ARRAY['almond','badam']),
('Just Cashews', 'dry fruits', 500, 'g', 499, ARRAY['cashew','kaju']),
('Just Raisins', 'dry fruits', 500, 'g', 185, ARRAY['raisin','kishmish']);