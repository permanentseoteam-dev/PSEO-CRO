-- Portal default accent moves from teal to Bordio blue (darkened to pass AA on white).
alter table portal_design_settings alter column accent set default '#0a74d1';
update portal_design_settings set accent = '#0a74d1' where lower(accent) = '#0f766e';
